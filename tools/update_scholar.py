#!/usr/bin/env python3
"""Refresh Google Scholar citation metadata for the Publications site.

Usage:
    python3 -m pip install requests beautifulsoup4
    python3 tools/update_scholar.py

Google Scholar does not provide a supported public API for this use. The script
uses the public author profile and may occasionally be blocked by Google. When
that happens, the website continues to work; only citation counts remain stale.
"""
from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

SCHOLAR_ID = "X75SjF8AAAAJ"
PROFILE = f"https://scholar.google.ca/citations?user={SCHOLAR_ID}&hl=en&pagesize=100"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "scholar.json"


def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def main() -> None:
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36"
    }
    response = requests.get(PROFILE, headers=headers, timeout=30)
    response.raise_for_status()
    if "not a robot" in response.text.lower() or "captcha" in response.text.lower():
        raise RuntimeError("Google Scholar returned a CAPTCHA. Try again later.")

    soup = BeautifulSoup(response.text, "html.parser")
    papers = {}
    for row in soup.select("tr.gsc_a_tr"):
        title_link = row.select_one("a.gsc_a_at")
        if not title_link:
            continue
        title = title_link.get_text(" ", strip=True)
        count_el = row.select_one("a.gsc_a_ac")
        citations = int(count_el.get_text(strip=True) or 0) if count_el else 0
        papers[normalize(title)] = {
            "title": title,
            "citations": citations,
            "url": urljoin("https://scholar.google.ca", title_link.get("href", "")),
        }

    aggregate = {}
    rows = soup.select("table#gsc_rsb_st tr")
    names = ["citations", "h_index", "i10_index"]
    for name, row in zip(names, rows):
        cells = row.select("td.gsc_rsb_std")
        if cells:
            try:
                aggregate[name] = int(cells[0].get_text(strip=True).replace(",", ""))
            except ValueError:
                pass

    payload = {
        "updated": dt.date.today().isoformat(),
        "aggregate": aggregate,
        "papers": papers,
    }
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Updated {OUT} with {len(papers)} Scholar publications.")


if __name__ == "__main__":
    main()
