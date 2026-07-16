"""Fetch and deduplicate articles from RSS/Atom feeds (including PR Newswire and Business Wire search feeds)."""

import hashlib
import re
from datetime import datetime, timezone, timedelta
from typing import Optional

import feedparser


def _parse_entry_date(entry) -> Optional[datetime]:
    """Extract a timezone-aware UTC datetime from a feed entry."""
    for attr in ("published_parsed", "updated_parsed", "created_parsed"):
        t = getattr(entry, attr, None)
        if t:
            try:
                return datetime(*t[:6], tzinfo=timezone.utc)
            except Exception:
                pass
    return None


def _entry_key(entry) -> str:
    """Stable dedup key: prefer canonical link, fall back to id, then title."""
    raw = (
        getattr(entry, "link", "")
        or getattr(entry, "id", "")
        or getattr(entry, "title", "")
    ).strip().lower()
    return hashlib.md5(raw.encode()).hexdigest()


def _clean_html(text: str, max_chars: int = 600) -> str:
    """Strip HTML tags and normalise whitespace."""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_chars]


def _passes_source_filter(entry, source_filter: list[str]) -> bool:
    """
    For wire feeds (PR Newswire, Business Wire) that return keyword-search results,
    verify the entry actually originated from the expected org.

    Checks the entry's author field and the first 500 chars of raw summary text
    (before HTML stripping) — wire releases consistently open with the org name.
    Any match on any filter term (case-insensitive) passes.
    """
    if not source_filter:
        return True

    candidates = [
        getattr(entry, "author", "") or "",
        getattr(entry, "summary", "") or "",
        getattr(entry, "description", "") or "",
        getattr(entry, "title", "") or "",
    ]
    # Only inspect the opening of longer fields to avoid false positives
    # where the org is merely mentioned mid-release
    haystack = " ".join(
        c[:500] if i > 0 else c for i, c in enumerate(candidates)
    ).lower()

    return any(term.lower() in haystack for term in source_filter)


def fetch_all_sources(
    sources: list[dict],
    days_back: int = 2,
    max_per_source: int = 20,
) -> list[dict]:
    """
    Fetch recent articles from every source in the list.

    Sources that have ``_section`` keys (used as comments in sources.json) are
    silently skipped.

    Returns a deduplicated list of article dicts with keys:
        org, category, source_name, title, summary, link, published
    Sorted by published date descending (newest first).
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)
    seen: set[str] = set()
    articles: list[dict] = []

    for source in sources:
        # Skip comment/section-marker entries and disabled sources
        if "_section" in source or source.get("_disabled"):
            continue

        name = source.get("name", "Unknown source")
        org = source.get("org", name)
        category = source.get("category", "")
        url = source.get("feed_url", "")
        source_filter = source.get("source_filter", [])

        if not url:
            print(f"  Skipping {name} — no feed_url configured")
            continue

        try:
            feed = feedparser.parse(
                url,
                request_headers={"User-Agent": "org-news-digest/1.0 (+github)"},
            )
        except Exception as exc:
            print(f"  ⚠ {name}: fetch error — {exc}")
            continue

        if feed.bozo and not feed.entries:
            print(f"  ⚠ {name}: feed parse error — {getattr(feed, 'bozo_exception', 'unknown')}")
            continue

        count = 0
        for entry in feed.entries[:max_per_source]:
            key = _entry_key(entry)
            if key in seen:
                continue  # duplicate across sources

            pub_date = _parse_entry_date(entry)

            # Skip articles older than the cutoff
            if pub_date and pub_date < cutoff:
                continue

            # For wire search feeds, skip entries not from the expected org
            if not _passes_source_filter(entry, source_filter):
                continue

            # Accept entries with no date (better to include than miss)
            seen.add(key)

            title = getattr(entry, "title", "").strip()
            link = getattr(entry, "link", "").strip()

            raw_summary = (
                getattr(entry, "summary", "")
                or getattr(entry, "description", "")
                or ""
            )
            summary = _clean_html(raw_summary)

            pub_str = pub_date.strftime("%Y-%m-%d") if pub_date else "Date unknown"

            articles.append(
                {
                    "org": org,
                    "category": category,
                    "source_name": name,
                    "title": title,
                    "summary": summary,
                    "link": link,
                    "published": pub_str,
                    "_pub_dt": pub_date or datetime.min.replace(tzinfo=timezone.utc),
                }
            )
            count += 1

        status = f"{count} item(s)" if count else "nothing new"
        print(f"  {name}: {status}")

    # Sort newest first, then strip internal sort key
    articles.sort(key=lambda a: a["_pub_dt"], reverse=True)
    for a in articles:
        del a["_pub_dt"]

    return articles
