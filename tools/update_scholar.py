#!/usr/bin/env python3
"""Refresh Google Scholar citation metadata for the Publications site.

Usage:
    python3 -m pip install requests beautifulsoup4
    python3 tools/update_scholar.py

Google Scholar does not provide a supported public API for this use. The script
uses the public author profile and may occasionally be blocked by Google. When
that happens, the website continues to work and retains the previous snapshot.
"""
from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

# Current profile ID first, historical profile ID second as a compatibility fallback.
SCHOLAR_IDS = ("X75SjF8AAAAJ", "cneuo_UAAAAJ")
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "scholar.json"


def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def parse_profile(html: str, scholar_id: str) -> dict | None:
    if "not a robot" in html.lower() or "captcha" in html.lower():
        raise RuntimeError("Google Scholar returned a CAPTCHA. Try again later.")

    soup = BeautifulSoup(html, "html.parser")
    profile_name = soup.select_one("#gsc_prf_in")
    if not profile_name or "stephen makonin" not in profile_name.get_text(" ", strip=True).lower():
        return None

    papers = {}
    for row in soup.select("tr.gsc_a_tr"):
        title_link = row.select_one("a.gsc_a_at")
        if not title_link:
            continue
        title = title_link.get_text(" ", strip=True)
        count_el = row.select_one("a.gsc_a_ac")
        raw_count = count_el.get_text(strip=True).replace(",", "") if count_el else "0"
        try:
            citations = int(raw_count or 0)
        except ValueError:
            citations = 0
        papers[normalize(title)] = {
            "title": title,
            "citations": citations,
            "url": urljoin("https://scholar.google.ca", title_link.get("href", "")),
        }

    aggregate = {}
    rows = soup.select("table#gsc_rsb_st tr")
    names = ("citations", "h_index", "i10_index")
    for name, row in zip(names, rows):
        cells = row.select("td.gsc_rsb_std")
        if cells:
            try:
                aggregate[name] = int(cells[0].get_text(strip=True).replace(",", ""))
            except ValueError:
                pass

    # Never overwrite a good local snapshot with an empty or malformed response.
    if "citations" not in aggregate or "h_index" not in aggregate or not papers:
        return None

    return {
        "updated": dt.date.today().isoformat(),
        "approximate": False,
        "scholar_id": scholar_id,
        "aggregate": aggregate,
        "papers": papers,
    }


def main() -> None:
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36"
    }

    errors = []
    for scholar_id in SCHOLAR_IDS:
        profile = f"https://scholar.google.ca/citations?user={scholar_id}&hl=en&pagesize=100"
        try:
            response = requests.get(profile, headers=headers, timeout=30)
            response.raise_for_status()
            payload = parse_profile(response.text, scholar_id)
            if payload:
                OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
                print(
                    f"Updated {OUT}: {payload['aggregate']['citations']} citations, "
                    f"h-index {payload['aggregate']['h_index']}, "
                    f"{len(payload['papers'])} Scholar publications."
                )
                return
            errors.append(f"{scholar_id}: profile did not contain valid Stephen Makonin Scholar data")
        except Exception as exc:
            errors.append(f"{scholar_id}: {exc}")

    raise RuntimeError(
        "Could not refresh Google Scholar. Existing scholar.json was left unchanged.\n"
        + "\n".join(errors)
    )


if __name__ == "__main__":
    main()
