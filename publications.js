const scholarProfile = 'https://scholar.google.ca/citations?user=X75SjF8AAAAJ&hl=en';

function stripBraces(value='') {
  return value.replace(/^\s*[{\"]|[}\"]\s*$/g, '').trim();
}

function parseBibtex(text) {
  const entries = [];
  let i = 0;
  while (i < text.length) {
    const at = text.indexOf('@', i);
    if (at < 0) break;
    const typeEnd = text.indexOf('{', at);
    if (typeEnd < 0) break;
    const type = text.slice(at + 1, typeEnd).trim().toLowerCase();
    let depth = 1, j = typeEnd + 1;
    while (j < text.length && depth > 0) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') depth--;
      j++;
    }
    const body = text.slice(typeEnd + 1, j - 1);
    const comma = body.indexOf(',');
    if (comma < 0) { i = j; continue; }
    const key = body.slice(0, comma).trim();
    const fieldsText = body.slice(comma + 1);
    const fields = {};
    let k = 0;
    while (k < fieldsText.length) {
      while (k < fieldsText.length && /[\s,]/.test(fieldsText[k])) k++;
      const eq = fieldsText.indexOf('=', k);
      if (eq < 0) break;
      const name = fieldsText.slice(k, eq).trim().toLowerCase();
      k = eq + 1;
      while (k < fieldsText.length && /\s/.test(fieldsText[k])) k++;
      let value = '';
      if (fieldsText[k] === '{') {
        let d = 1; const start = ++k;
        while (k < fieldsText.length && d > 0) {
          if (fieldsText[k] === '{') d++;
          else if (fieldsText[k] === '}') d--;
          k++;
        }
        value = fieldsText.slice(start, k - 1);
      } else if (fieldsText[k] === '"') {
        const start = ++k;
        while (k < fieldsText.length && fieldsText[k] !== '"') k++;
        value = fieldsText.slice(start, k++);
      } else {
        const start = k;
        while (k < fieldsText.length && fieldsText[k] !== ',') k++;
        value = fieldsText.slice(start, k).trim();
      }
      fields[name] = value.trim();
    }
    entries.push({ type, key, ...fields });
    i = j;
  }
  return entries;
}

function cleanTeX(s='') {
  return s
    .replace(/\\&/g, '&')
    .replace(/\\'\{?([A-Za-z])\}?/g, '$1')
    .replace(/\\l\{?\}?/g, 'l')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTitle(s='') {
  return cleanTeX(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isStephenMakonin(name='') {
  const normalized = cleanTeX(name)
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return /^makonin,\s*(stephen(?:\s+(?:william|w))?|s(?:\s+w)?)\b/.test(normalized)
    || /^(stephen(?:\s+(?:william|w))?|s(?:\s+w)?)\s+makonin\b/.test(normalized);
}

function renderAuthors(container, authorField='') {
  const authors = authorField.split(/\s+and\s+/i).map(cleanTeX).filter(Boolean);

  authors.forEach((name, index) => {
    if (index > 0) container.appendChild(document.createTextNode(' and '));

    if (isStephenMakonin(name)) {
      const strong = document.createElement('strong');
      strong.textContent = name;
      container.appendChild(strong);
    } else {
      container.appendChild(document.createTextNode(name));
    }
  });
}

function venueOf(p) {
  return cleanTeX(p.journal || p.booktitle || p.howpublished || p.publisher || '');
}

function typeLabel(p) {
  if (p.type === 'article') return 'Journal';
  if (p.type === 'inproceedings') return 'Conference';
  if (p.type === 'incollection') return 'Book chapter';
  if (p.type === 'book') return 'Book';

  const subtype = cleanTeX(p.note || '');
  return subtype ? `Other · ${subtype}` : 'Other';
}

function aggregateNumber(aggregate={}, ...keys) {
  for (const key of keys) {
    if (!(key in aggregate)) continue;
    const raw = aggregate[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string') {
      const parsed = Number(raw.replace(/,/g, '').trim());
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function doiUrl(p) {
  const doi = stripBraces(p.doi || '').replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  return doi ? `https://doi.org/${doi}` : (p.url || '');
}

function scholarSearch(title) {
  return `${scholarProfile}&q=${encodeURIComponent(cleanTeX(title))}`;
}

async function getJSON(path, fallback={}) {
  try {
    const r = await fetch(path, { cache: 'no-store' });
    if (!r.ok) return fallback;
    return await r.json();
  } catch { return fallback; }
}

function makeBadge(text, metric=false) {
  const span = document.createElement('span');
  span.className = `badge${metric ? ' metric' : ''}`;
  span.textContent = text;
  return span;
}

function action(label, href, primary=false) {
  const a = document.createElement('a');
  a.className = `pub-action${primary ? ' primary' : ''}`;
  a.href = href;
  a.textContent = label;
  if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
  return a;
}

async function init() {
  const [bibResponse, journals, scholar] = await Promise.all([
    fetch('publications.bib', { cache: 'no-store' }),
    getJSON('journals.json', {}),
    getJSON('scholar.json', { updated: null, aggregate: {}, papers: {} })
  ]);

  if (!bibResponse.ok) throw new Error('BibTeX load failed');
  const publications = parseBibtex(await bibResponse.text())
    .filter(p => p.title && p.year)
    .map((p, index) => ({ ...p, _id: `${p.key}-${index}` }))
    .sort((a,b) => Number(b.year) - Number(a.year) || cleanTeX(a.title).localeCompare(cleanTeX(b.title)));

  const years = [...new Set(publications.map(p => p.year))].sort((a,b) => Number(b)-Number(a));
  const yearSelect = document.querySelector('#year-filter');
  years.forEach(y => { const o=document.createElement('option'); o.value=y; o.textContent=y; yearSelect.appendChild(o); });

  document.querySelector('#publication-count').textContent = publications.length;
  document.querySelector('#journal-count').textContent = publications.filter(p => p.type === 'article' && p.journal).length;

  const citations = aggregateNumber(scholar.aggregate, 'citations', 'Citations');
  const hIndex = aggregateNumber(scholar.aggregate, 'h_index', 'h-index', 'hIndex');
  document.querySelector('#citation-count').textContent = citations === null ? '—' : citations.toLocaleString();
  document.querySelector('#h-index-count').textContent = hIndex === null ? '—' : hIndex.toLocaleString();

  const scholarUpdated = document.querySelector('#scholar-updated');
  if (scholar.updated) {
    scholarUpdated.textContent = scholar.approximate
      ? `Google Scholar snapshot ${scholar.updated}; run the updater for exact current values.`
      : `Google Scholar citation counts refreshed ${scholar.updated}.`;
  } else if (citations !== null || hIndex !== null) {
    scholarUpdated.textContent = 'Google Scholar snapshot; run the updater to refresh current values.';
  }

  const search = document.querySelector('#search');
  const typeFilter = document.querySelector('#type-filter');
  const yearFilter = document.querySelector('#year-filter');
  const list = document.querySelector('#publication-list');
  const resultCount = document.querySelector('#result-count');

  function render() {
    const q = search.value.trim().toLowerCase();
    const type = typeFilter.value;
    const year = yearFilter.value;
    const filtered = publications.filter(p => {
      const hay = [p.title,p.author,venueOf(p),p.note,p.key,p.keywords,p.year].map(cleanTeX).join(' ').toLowerCase();
      return (!q || hay.includes(q)) && (type === 'all' || p.type === type) && (year === 'all' || p.year === year);
    });
    list.innerHTML = '';
    resultCount.textContent = `${filtered.length} of ${publications.length} publications`;
    if (!filtered.length) {
      const div = document.createElement('div'); div.className='empty-state'; div.textContent='No publications match these filters.'; list.appendChild(div); return;
    }

    filtered.forEach(p => {
      const item = document.createElement('article'); item.className='publication';
      const y = document.createElement('p'); y.className='pub-year'; y.textContent=p.year;
      const content = document.createElement('div');
      const h3 = document.createElement('h3'); h3.className='pub-title';
      const finalUrl = doiUrl(p);
      if (finalUrl) { const a=document.createElement('a'); a.href=finalUrl; a.target='_blank'; a.rel='noopener'; a.textContent=cleanTeX(p.title); h3.appendChild(a); }
      else h3.textContent=cleanTeX(p.title);
      const authors=document.createElement('p'); authors.className='pub-authors'; renderAuthors(authors, p.author || '');
      const venue=document.createElement('p'); venue.className='pub-venue'; venue.textContent=venueOf(p);
      const badges=document.createElement('div'); badges.className='pub-badges';
      const metrics = journals[venueOf(p)] || {};
      if (metrics.impact_factor) badges.appendChild(makeBadge(`Impact Factor ${metrics.impact_factor}${metrics.year ? ` (${metrics.year})` : ''}`, true));
      if (metrics.citescore) badges.appendChild(makeBadge(`CiteScore ${metrics.citescore}${metrics.citescore_year ? ` (${metrics.citescore_year})` : ''}`, true));
      const s = scholar.papers?.[normalizeTitle(p.title)];
      if (s?.citations != null && Number.isFinite(Number(s.citations))) badges.appendChild(makeBadge(`${Number(s.citations).toLocaleString()} citations`, true));
      badges.appendChild(makeBadge(typeLabel(p)));
      const actions=document.createElement('div'); actions.className='pub-actions';
      if (finalUrl) actions.appendChild(action(p.doi ? 'Final publication / DOI ↗' : 'Final publication ↗', finalUrl, true));
      if (p.pdf) actions.appendChild(action('Author version', cleanTeX(p.pdf)));
      actions.appendChild(action('Google Scholar ↗', s?.url || scholarSearch(p.title)));
      if (p.code) actions.appendChild(action('Code ↗', cleanTeX(p.code)));
      content.append(h3, authors, venue, badges, actions); item.append(y,content); list.appendChild(item);
    });
  }
  [search,typeFilter,yearFilter].forEach(el => el.addEventListener(el === search ? 'input' : 'change', render));
  render();
}

init().catch(err => {
  console.error(err);
  document.querySelector('#load-error').hidden = false;
  document.querySelector('#result-count').textContent = 'Unable to load publication data';
});
