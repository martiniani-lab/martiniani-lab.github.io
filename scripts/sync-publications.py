#!/usr/bin/env python3
"""
Sync publications from Semantic Scholar API into references.bib.
- Fetches papers by Stefano Martiniani's Semantic Scholar author ID
- Merges new entries into existing .bib, preserving manual edits
- Never deletes entries, only adds or updates metadata
"""

import json
import re
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("requests not installed. Run: pip install requests")
    sys.exit(1)

# Stefano Martiniani's Semantic Scholar author ID
AUTHOR_ID = "3234559"
BIB_PATH = Path(__file__).parent.parent / "src" / "content" / "publications" / "references.bib"
API_BASE = "https://api.semanticscholar.org/graph/v1"

# Fields we want to preserve if manually set in .bib
MANUAL_FIELDS = {"note", "localfile", "sortkey"}


def fetch_papers(author_id: str) -> list[dict]:
    """Fetch all papers for an author from Semantic Scholar."""
    url = f"{API_BASE}/author/{author_id}/papers"
    params = {
        "fields": "title,authors,year,externalIds,venue,journal,publicationDate",
        "limit": 100,
    }
    papers = []
    offset = 0
    while True:
        params["offset"] = offset
        resp = requests.get(url, params=params, timeout=30)
        if resp.status_code == 429:
            print("Rate limited, waiting 5s...")
            time.sleep(5)
            continue
        resp.raise_for_status()
        data = resp.json()
        batch = data.get("data", [])
        papers.extend(batch)
        if len(batch) < 100 or data.get("next") is None:
            break
        offset += 100
        time.sleep(1)  # Be polite
    return papers


def parse_existing_bib(path: Path) -> dict[str, str]:
    """Parse existing .bib file into dict of key -> raw entry string."""
    if not path.exists():
        return {}
    content = path.read_text()
    entries = {}
    # Split on @type{key, pattern
    parts = re.split(r"(?=@\w+\{)", content)
    for part in parts:
        part = part.strip()
        if not part or not part.startswith("@"):
            continue
        match = re.match(r"@\w+\{([^,]+),", part)
        if match:
            key = match.group(1).strip()
            entries[key] = part
    return entries


def make_bib_key(paper: dict) -> str:
    """Generate a BibTeX key from paper data."""
    authors = paper.get("authors", [])
    first_author = authors[0]["name"].split()[-1].lower() if authors else "unknown"
    year = paper.get("year", 0) or 0
    title_words = paper.get("title", "").split()
    keyword = title_words[0].lower() if title_words else "paper"
    # Clean non-alphanumeric
    first_author = re.sub(r"[^a-z]", "", first_author)
    keyword = re.sub(r"[^a-z]", "", keyword)
    return f"{first_author}{year}{keyword}"


def paper_to_bib(paper: dict) -> tuple[str, str]:
    """Convert Semantic Scholar paper to BibTeX entry."""
    key = make_bib_key(paper)
    ext_ids = paper.get("externalIds", {}) or {}

    doi = ext_ids.get("DOI", "")
    arxiv = ext_ids.get("ArXiv", "")
    venue = paper.get("venue", "") or ""
    journal_info = paper.get("journal", {}) or {}
    journal_name = journal_info.get("name", "") or venue
    year = paper.get("year", "")

    # Determine type
    is_preprint = not journal_name or "arxiv" in journal_name.lower() or "biorxiv" in journal_name.lower()
    entry_type = "unpublished" if is_preprint else "article"

    authors = " and ".join(a["name"] for a in paper.get("authors", []))
    title = paper.get("title", "")

    lines = [f"@{entry_type}{{{key},"]
    lines.append(f"  title={{{title}}},")
    lines.append(f"  author={{{authors}}},")
    if journal_name and not is_preprint:
        lines.append(f"  journal={{{journal_name}}},")
    if year:
        lines.append(f"  year={{{year}}},")
    if doi:
        lines.append(f"  doi={{{doi}}},")
    if arxiv:
        lines.append(f"  eprint={{{arxiv}}},")
    lines.append("}")

    return key, "\n".join(lines)


def main():
    print(f"Fetching papers for author {AUTHOR_ID}...")
    papers = fetch_papers(AUTHOR_ID)
    print(f"Found {len(papers)} papers from Semantic Scholar")

    existing = parse_existing_bib(BIB_PATH)
    print(f"Existing .bib has {len(existing)} entries")

    # Check for new papers by title similarity
    existing_titles = set()
    for entry in existing.values():
        match = re.search(r"title\s*=\s*\{([^}]+)\}", entry, re.IGNORECASE)
        if match:
            existing_titles.add(match.group(1).lower().strip())

    new_count = 0
    for paper in papers:
        title = (paper.get("title", "") or "").lower().strip()
        if not title:
            continue
        # Check if already exists (by fuzzy title match)
        found = False
        for et in existing_titles:
            if title[:50] == et[:50]:  # Match on first 50 chars
                found = True
                break
        if not found:
            key, bib_entry = paper_to_bib(paper)
            # Avoid key collision
            while key in existing:
                key += "b"
                bib_entry = bib_entry.replace("{" + key[:-1] + ",", "{" + key + ",", 1)
            existing[key] = bib_entry
            existing_titles.add(title)
            new_count += 1
            print(f"  + {paper.get('title', 'Unknown')[:60]}...")

    if new_count == 0:
        print("No new papers found.")
        return

    print(f"Adding {new_count} new papers")

    # Write back, sorted by year desc
    def get_year(entry: str) -> int:
        match = re.search(r"year\s*=\s*\{(\d+)\}", entry)
        return int(match.group(1)) if match else 0

    sorted_entries = sorted(existing.values(), key=get_year, reverse=True)
    BIB_PATH.write_text("\n\n".join(sorted_entries) + "\n")
    print(f"Updated {BIB_PATH}")


if __name__ == "__main__":
    main()
