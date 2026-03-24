#!/usr/bin/env python3
"""
Fetch publications from Stefano Martiniani's Google Scholar profile
and update references.bib, preserving manual metadata (notes, localfile, etc.).

Only papers shown on the curated Scholar profile are included.
Papers in references.bib that are NOT on the profile are removed.

Usage:
  python scripts/fetch_scholar.py [--dry-run]

  For reliable operation, set a ScraperAPI key (free tier: 5000 req/month):
    export SCRAPERAPI_KEY=your_key_here
    python scripts/fetch_scholar.py

  Without an API key, the script tries direct access (may be blocked by Google).

Requirements:
  pip install scholarly 'httpx<0.28' func-timeout
"""

from __future__ import annotations

import os
import random
import re
import sys
import time
import difflib
from pathlib import Path
from typing import Any

try:
    from scholarly import scholarly, ProxyGenerator
except ImportError:
    print("scholarly not installed. Run: pip install scholarly 'httpx<0.28'")
    sys.exit(1)

try:
    from func_timeout import func_timeout, FunctionTimedOut
except ImportError:
    print("func-timeout not installed. Run: pip install func-timeout")
    sys.exit(1)

SCHOLAR_ID = "pxSj9JkAAAAJ"  # Stefano Martiniani
BIB_PATH = Path(__file__).parent.parent / "src" / "content" / "publications" / "references.bib"

# Fields to preserve from existing .bib entries when merging
PRESERVE_FIELDS = {"note", "localfile", "localPdf", "sortkey"}

# Timeout per scholarly call (seconds) — kills hanging requests
CALL_TIMEOUT = 60

# Rate limiting (only used without ScraperAPI)
MIN_DELAY = 2.0
MAX_DELAY = 5.0
MAX_RETRIES = 3

# Global flag: skip delays when ScraperAPI handles rate limiting
_using_scraperapi = False


def setup_proxy():
    """Set up proxy for Google Scholar access.

    Prefers ScraperAPI (via SCRAPERAPI_KEY env var) for reliable access.
    Falls back to direct access with a warning.
    """
    global _using_scraperapi
    api_key = os.environ.get("SCRAPERAPI_KEY", "")

    if api_key:
        try:
            pg = ProxyGenerator()
            success = pg.ScraperAPI(api_key)
            if success:
                scholarly.use_proxy(pg)
                _using_scraperapi = True
                print("Using ScraperAPI proxy for Google Scholar access")
                return
            else:
                print("WARNING: ScraperAPI setup returned failure, trying FreeProxies")
        except Exception as e:
            print(f"WARNING: ScraperAPI setup failed ({e}), trying FreeProxies")

    # Try free proxies as fallback
    try:
        pg = ProxyGenerator()
        success = pg.FreeProxies()
        if success:
            scholarly.use_proxy(pg)
            print("Using free proxy (less reliable than ScraperAPI)")
            return
    except Exception as e:
        print(f"WARNING: FreeProxies setup failed ({e})")

    print("WARNING: No proxy available — trying direct access (may be blocked by Google)")
    print("  Tip: export SCRAPERAPI_KEY=your_key for reliable access")
    print("  Free tier at https://www.scraperapi.com (5000 req/month)")


def call_with_timeout(func, args=(), timeout_sec=CALL_TIMEOUT, description="operation"):
    """Call func(*args) with a hard timeout and retry on failure/hang.

    Uses func_timeout (thread-based) to kill hanging calls — scholarly has no
    built-in timeout on fill()/search_author_id() and can hang indefinitely.
    """
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return func_timeout(timeout_sec, func, args=args)
        except FunctionTimedOut:
            print(f"    Timeout ({timeout_sec}s) on attempt {attempt}/{MAX_RETRIES} "
                  f"for {description}")
            if attempt == MAX_RETRIES:
                raise
        except Exception as e:
            if attempt == MAX_RETRIES:
                raise
            delay = (2 ** attempt) + random.uniform(0, 1)
            print(f"    Error on attempt {attempt}/{MAX_RETRIES} for {description} "
                  f"(retrying in {delay:.1f}s): {e}")
            time.sleep(delay)


def polite_sleep():
    """Random delay between requests (skipped when ScraperAPI is active)."""
    if _using_scraperapi:
        return
    delay = random.uniform(MIN_DELAY, MAX_DELAY)
    time.sleep(delay)


def fetch_scholar_publications() -> list[dict[str, Any]]:
    """Fetch all publications from Google Scholar profile."""
    setup_proxy()
    print(f"\nFetching Google Scholar profile {SCHOLAR_ID}...")

    author = call_with_timeout(
        scholarly.search_author_id, args=(SCHOLAR_ID,),
        description="search_author_id"
    )
    polite_sleep()

    def _fill_author(a):
        return scholarly.fill(a, sections=["publications"])

    author = call_with_timeout(
        _fill_author, args=(author,),
        description="fill author profile"
    )
    polite_sleep()

    pubs = []
    total = len(author["publications"])
    print(f"Found {total} publications on profile, fetching details...\n")

    for i, pub_stub in enumerate(author["publications"]):
        title = pub_stub.get("bib", {}).get("title", "?")
        print(f"  [{i+1}/{total}] {title[:70]}...")
        try:
            filled = call_with_timeout(
                scholarly.fill, args=(pub_stub,),
                description=f"fill pub {i+1}"
            )
            polite_sleep()
        except Exception as e:
            print(f"    WARNING: Failed after {MAX_RETRIES} attempts: {e}")
            print(f"    Using stub data (may have incomplete metadata)")
            filled = pub_stub
        pubs.append(filled)

    print(f"\nFetched {len(pubs)} publications from Google Scholar")
    return pubs


def parse_existing_bib(path: Path) -> dict[str, str]:
    """Parse existing .bib file into dict of key -> raw entry string."""
    if not path.exists():
        return {}
    content = path.read_text()
    entries = {}
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


def extract_field(entry: str, field: str) -> str:
    """Extract a field value from a raw BibTeX entry string."""
    # Handle multi-line fields with balanced braces
    pattern = rf"{field}\s*=\s*\{{((?:[^{{}}]|\{{[^{{}}]*\}})*)\}}"
    m = re.search(pattern, entry, re.IGNORECASE | re.DOTALL)
    return m.group(1).strip() if m else ""


def normalize_title(title: str) -> str:
    """Normalize title for comparison: lowercase, strip punctuation/whitespace."""
    t = title.lower().strip()
    t = re.sub(r"[^a-z0-9\s]", "", t)
    t = re.sub(r"\s+", " ", t)
    return t


def title_similarity(a: str, b: str) -> float:
    """Compute title similarity ratio (0-1)."""
    na, nb = normalize_title(a), normalize_title(b)
    return difflib.SequenceMatcher(None, na, nb).ratio()


def match_existing_entry(title: str, existing: dict[str, str]) -> tuple:
    """Find the best matching existing entry by title. Returns (key, raw_entry) or (None, None)."""
    best_key, best_score = None, 0.0
    for key, entry in existing.items():
        existing_title = extract_field(entry, "title")
        if not existing_title:
            continue
        score = title_similarity(title, existing_title)
        if score > best_score:
            best_score = score
            best_key = key
    if best_score >= 0.75:
        return best_key, existing[best_key]
    return None, None


def format_author_bibtex(name: str) -> str:
    """Convert 'First Last' to 'Last, F.' or 'Last, F.M.' BibTeX format."""
    parts = name.strip().split()
    if len(parts) == 0:
        return name
    if len(parts) == 1:
        return parts[0]
    last = parts[-1]
    initials = ".".join(p[0].upper() for p in parts[:-1]) + "."
    return f"{last}, {initials}"


def make_bib_key(authors: list[str], year, title: str) -> str:
    """Generate a BibTeX key: firstauthorlastname + year + firsttitleword."""
    first_author = authors[0] if authors else "unknown"
    # Get last name
    if "," in first_author:
        lastname = first_author.split(",")[0].strip()
    else:
        parts = first_author.split()
        lastname = parts[-1] if parts else "unknown"
    lastname = re.sub(r"[^a-zA-Z]", "", lastname).lower()

    title_words = re.sub(r"[^a-zA-Z\s]", "", title).split()
    # Skip common short words
    skip = {"a", "an", "the", "of", "in", "on", "for", "and", "to", "with", "by", "from", "is", "are", "at"}
    keyword = ""
    for w in title_words:
        if w.lower() not in skip:
            keyword = w.lower()
            break
    if not keyword and title_words:
        keyword = title_words[0].lower()

    return f"{lastname}{year}{keyword}"


def scholar_pub_to_bib(pub: dict[str, Any], existing: dict[str, str]) -> tuple:
    """Convert a scholarly publication dict to a BibTeX entry string.
    Returns (key, bib_entry_string).

    When Scholar fill() failed (stub data only), the existing bib entry is used
    as the base — Scholar stubs lack journal/volume/pages/full author lists.
    """
    bib = pub.get("bib", {})
    title = bib.get("title", "")
    is_stub = not pub.get("filled", False)

    # Try to match to existing entry
    matched_key, matched_entry = match_existing_entry(title, existing)

    # If Scholar fill failed and we have an existing entry, keep existing as-is
    # (just update preserved fields tracking so it's included in output)
    if is_stub and matched_entry:
        return matched_key, matched_entry

    authors_raw = bib.get("author", [])
    if isinstance(authors_raw, str):
        authors_raw = [a.strip() for a in authors_raw.split(" and ")]
    year = bib.get("pub_year", "") or ""
    journal = bib.get("journal", "") or bib.get("venue", "") or bib.get("citation", "") or ""
    volume = bib.get("volume", "") or ""
    number = bib.get("number", "") or ""
    pages = bib.get("pages", "") or ""

    # Get external IDs
    pub_url = pub.get("pub_url", "") or ""
    eprint = pub.get("eprint_url", "") or ""

    # Format authors for BibTeX
    authors_bib = [format_author_bibtex(a) for a in authors_raw]
    author_str = " and ".join(authors_bib)

    # Preserve fields from existing entry
    preserved = {}
    if matched_entry:
        for field in PRESERVE_FIELDS:
            val = extract_field(matched_entry, field)
            if val:
                preserved[field] = val
        # Also preserve eprint/arxiv if existing has it and Scholar doesn't
        existing_eprint = extract_field(matched_entry, "eprint")
        if existing_eprint:
            preserved["eprint"] = existing_eprint
        existing_doi = extract_field(matched_entry, "doi")
        if existing_doi:
            preserved["doi"] = existing_doi
        existing_url = extract_field(matched_entry, "url")
        if existing_url and not pub_url:
            preserved["url"] = existing_url
        # Preserve journal/volume/pages if Scholar didn't provide them
        if not journal:
            journal = extract_field(matched_entry, "journal") or ""
        if not volume:
            volume = extract_field(matched_entry, "volume") or ""
        if not number:
            number = extract_field(matched_entry, "number") or ""
        if not pages:
            pages = extract_field(matched_entry, "pages") or ""

    # Determine entry type
    is_preprint = False
    if journal:
        jl = journal.lower()
        if "arxiv" in jl or "biorxiv" in jl or "medrxiv" in jl:
            is_preprint = True
    elif not journal:
        is_preprint = True

    # Check if it's a thesis
    is_thesis = "thesis" in title.lower() or "dissertation" in title.lower()

    if is_thesis:
        entry_type = "phdthesis"
    elif is_preprint:
        entry_type = "unpublished"
    else:
        entry_type = "article"

    # Generate key (use existing key if matched)
    if matched_key:
        key = matched_key
    else:
        key = make_bib_key(authors_raw, year, title)

    # Build entry
    lines = [f"@{entry_type}{{{key},"]
    lines.append(f"  title     = {{{title}}},")
    lines.append(f"  author    = {{{author_str}}},")

    if entry_type == "phdthesis":
        # For theses, use school field
        if journal:
            lines.append(f"  school    = {{{journal}}},")
    elif journal and not is_preprint:
        lines.append(f"  journal   = {{{journal}}},")

    if volume:
        lines.append(f"  volume    = {{{volume}}},")
    if number:
        lines.append(f"  number    = {{{number}}},")
    if pages:
        lines.append(f"  pages     = {{{pages}}},")
    if year:
        lines.append(f"  year      = {{{year}}},")

    # DOI
    doi = preserved.get("doi", "")
    if not doi and pub_url and "doi.org" in pub_url:
        doi = pub_url.split("doi.org/")[-1]
    if doi:
        lines.append(f"  doi       = {{{doi}}},")

    # arXiv eprint
    arxiv_eprint = preserved.get("eprint", "")
    if not arxiv_eprint and eprint and "arxiv.org" in eprint:
        # Extract arxiv ID from URL
        arxiv_match = re.search(r"arxiv\.org/abs/(\S+)", eprint)
        if arxiv_match:
            arxiv_eprint = arxiv_match.group(1)
    if arxiv_eprint:
        lines.append(f"  eprint    = {{{arxiv_eprint}}},")

    # URL
    url = preserved.get("url", "") or pub_url
    if url:
        lines.append(f"  url       = {{{url}}},")

    # Preserved fields
    if preserved.get("localfile"):
        lines.append(f"  localfile = {{{preserved['localfile']}}},")
    if preserved.get("localPdf"):
        lines.append(f"  localPdf  = {{{preserved['localPdf']}}},")
    if preserved.get("note"):
        lines.append(f"  note      = {{{preserved['note']}}},")
    if preserved.get("sortkey"):
        lines.append(f"  sortkey   = {{{preserved['sortkey']}}},")

    lines.append("}")

    return key, "\n".join(lines)


def main():
    dry_run = "--dry-run" in sys.argv

    # Fetch from Scholar
    pubs = fetch_scholar_publications()

    # Parse existing bib
    existing = parse_existing_bib(BIB_PATH)
    print(f"Existing .bib has {len(existing)} entries")

    # Convert Scholar publications to BibTeX
    new_entries: dict[str, str] = {}
    matched_existing_keys: set[str] = set()

    for pub in pubs:
        bib = pub.get("bib", {})
        title = bib.get("title", "")
        if not title:
            continue

        key, entry = scholar_pub_to_bib(pub, existing)

        # Track which existing entries were matched
        matched_key, _ = match_existing_entry(title, existing)
        if matched_key:
            matched_existing_keys.add(matched_key)

        # Handle key collisions
        base_key = key
        suffix = "b"
        while key in new_entries and key != matched_key:
            key = base_key + suffix
            entry = entry.replace(f"{{{base_key},", f"{{{key},", 1)
            suffix = chr(ord(suffix) + 1)

        new_entries[key] = entry

    # Report removed entries
    removed_keys = set(existing.keys()) - matched_existing_keys - set(new_entries.keys())
    if removed_keys:
        print(f"\nEntries NOT found on Scholar profile (will be removed):")
        for k in sorted(removed_keys):
            title = extract_field(existing[k], "title")
            print(f"  - {k}: {title[:70]}")

    # Report new entries
    new_keys = set(new_entries.keys()) - set(existing.keys())
    if new_keys:
        print(f"\nNew entries from Scholar:")
        for k in sorted(new_keys):
            title = extract_field(new_entries[k], "title")
            print(f"  + {k}: {title[:70]}")

    # Report updated entries
    updated_keys = set(new_entries.keys()) & set(existing.keys())
    if updated_keys:
        print(f"\nUpdated entries: {len(updated_keys)}")

    # Sort by year descending
    def get_year(entry: str) -> int:
        m = re.search(r"year\s*=\s*\{(\d+)\}", entry)
        return int(m.group(1)) if m else 0

    # Separate preprints and published
    preprints = []
    published = []
    theses = []

    for key, entry in new_entries.items():
        if entry.startswith("@phdthesis"):
            theses.append(entry)
        elif entry.startswith("@unpublished"):
            preprints.append(entry)
        else:
            published.append(entry)

    preprints.sort(key=get_year, reverse=True)
    published.sort(key=get_year, reverse=True)
    theses.sort(key=get_year, reverse=True)

    # Build output
    sections = []
    sections.append("% =============================================================================")
    sections.append("% Martiniani Lab — Complete Publication List")
    sections.append("% Sorted newest first; auto-generated from Google Scholar profile")
    sections.append("% Manual fields (note, localfile) are preserved across updates")
    sections.append("% =============================================================================")

    if preprints:
        sections.append("")
        sections.append("% ---------------------------------------------------------------------------")
        sections.append("% Preprints")
        sections.append("% ---------------------------------------------------------------------------")
        sections.append("")
        sections.append("\n\n".join(preprints))

    if published:
        sections.append("")
        sections.append("% ---------------------------------------------------------------------------")
        sections.append("% Published")
        sections.append("% ---------------------------------------------------------------------------")
        sections.append("")
        sections.append("\n\n".join(published))

    if theses:
        sections.append("")
        sections.append("% ---------------------------------------------------------------------------")
        sections.append("% Ph.D. Theses")
        sections.append("% ---------------------------------------------------------------------------")
        sections.append("")
        sections.append("\n\n".join(theses))

    output = "\n".join(sections) + "\n"

    if dry_run:
        print(f"\n--- DRY RUN ---")
        print(f"Would write {len(new_entries)} entries to {BIB_PATH}")
        print(f"  Preprints: {len(preprints)}")
        print(f"  Published: {len(published)}")
        print(f"  Theses:    {len(theses)}")
        print(f"\nRun without --dry-run to update the file.")
    else:
        BIB_PATH.write_text(output)
        print(f"\nWrote {len(new_entries)} entries to {BIB_PATH}")


if __name__ == "__main__":
    main()
