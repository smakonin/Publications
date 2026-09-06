# Publications

Author versions and bibliographic metadata for publications by **Prof. Stephen Makonin, PEng**.

The GitHub Pages site is designed to remain easy to maintain as new work is published.

## Files

- `index.html` — publication homepage.
- `style.css` — dark-green theme matching `makonin.com`.
- `publications.bib` — **source of truth** for the publication list.
- `publications.js` — reads the BibTeX file and builds the searchable/filterable page.
- `journals.json` — annual journal Impact Factor / CiteScore metadata.
- `scholar.json` — cached Google Scholar publication links and citation counts.
- `papers/` — author-version PDFs, named using their BibTeX keys.
- `tools/update_scholar.py` — optional Scholar citation refresh utility.

## BibTeX key and PDF naming convention

Use a readable BibTeX key based on the first author, publication year, and a significant word from the title:

```text
<firstauthor><year><titleword>
```

For example:

```text
makonin2015nonintrusive
harell2021tracegan
makonin2024descriptor
```

If that key would duplicate another publication, append another distinguishing word from the title rather than a number. For example:

```text
makonin2013inspiringembedded
makonin2013inspiringdisplay
```

Every author-version PDF should use the exact BibTeX key as its basename:

```text
papers/<bibkey>.pdf
```

The corresponding BibTeX entry should therefore contain:

```bibtex
pdf={papers/<bibkey>.pdf}
```

## Adding a publication

1. Choose the BibTeX key using the convention above.
2. Save the author manuscript as `papers/<bibkey>.pdf`.
3. Add one BibTeX entry to `publications.bib` using that same key.
4. Include a DOI whenever one exists.
5. Add `pdf={papers/<bibkey>.pdf}` when an author version is available.
6. Commit and push. The homepage will show the new item automatically; there is no HTML to edit.

Example:

```bibtex
@article{example2026article,
  title={Example Article Title},
  author={Makonin, Stephen and Example, Alice},
  journal={Example Journal},
  year={2026},
  doi={10.1234/example.2026.1},
  pdf={papers/example2026article.pdf}
}
```

Optional fields supported by the website include `url`, `pdf`, `code`, and `keywords`.

## Updating Google Scholar citation counts

Google Scholar does not provide a supported public API for live citation counts, so the site uses a cached `scholar.json` file. Refresh it locally when desired:

```bash
python3 -m pip install requests beautifulsoup4
python3 tools/update_scholar.py
git add scholar.json
git commit -m "Refresh Google Scholar citations"
git push
```

Google occasionally blocks automated profile requests. If that happens, do nothing: the publication site continues to work and simply retains the previous citation snapshot.

## Updating journal metrics

Update `journals.json` once per year using publisher/JCR/Scopus data. Each record may contain:

```json
"Journal Name": {
  "impact_factor": 4.2,
  "year": 2025,
  "citescore": 9.0,
  "citescore_year": 2024,
  "source": "Publisher"
}
```

Do not overwrite old metrics without updating their corresponding year.

## Author version links

The site only shows an **Author version** button when the BibTeX entry has a `pdf={...}` field. Because the PDF basename matches the BibTeX key, the metadata-to-manuscript relationship is explicit and easy to validate.
