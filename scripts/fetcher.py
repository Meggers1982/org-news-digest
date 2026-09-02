"""Fetch and deduplicate articles from RSS/Atom feeds (including PR Newswire and
Business Wire search feeds), plus a small number of HTML-scraped sources for
sites that expose no feed at all — see `_fetch_html_source`."""

import hashlib
import re
import socket
from datetime import datetime, timezone, timedelta
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import feedparser
from bs4 import BeautifulSoup

# feedparser has no timeout parameter and urllib defaults to blocking forever,
# so a single stalled feed would hang the whole scheduled run.
FEED_TIMEOUT_SECONDS = 20


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


def _parse_html_date(text: str) -> Optional[datetime]:
    """Parse a 'Mon D, YYYY' date string (HarrisX's card format) as UTC."""
    try:
        return datetime.strptime(text.strip(), "%b %d, %Y").replace(tzinfo=timezone.utc)
    except (ValueError, AttributeError):
        return None


def _fetch_html_source(
    source: dict,
    cutoff: datetime,
    max_per_source: int,
    seen: set[str],
    articles: list[dict],
) -> None:
    """
    Scrape a source's news page directly, for sources confirmed (by hand) to
    expose no RSS/Atom feed at all — see the source's ``notes`` field.

    Only supports the Webflow CMS post-listing markup used by HarrisX's
    /news page today: each item is an ``<a class="link-dark-fg">`` card
    containing an ``<h5 class="black-text">`` title, a ``<p class="paragraph-75">``
    summary, and a trailing ``<p class="text-sm">`` date. This is inherently
    fragile — a redesign of that page will silently start returning zero
    items rather than raising, the same failure mode as a stale feed url.
    """
    name = source.get("name", "Unknown source")
    org = source.get("org", name)
    category = source.get("category", "")
    url = source.get("url", "")

    if not url:
        print(f"  Skipping {name} — no url configured")
        return

    try:
        request = Request(url, headers={"User-Agent": "org-news-digest/1.0 (+github)"})
        with urlopen(request, timeout=FEED_TIMEOUT_SECONDS) as response:
            html = response.read()
    except (URLError, HTTPError, TimeoutError, OSError) as exc:
        print(f"  ⚠ {name}: fetch error — {exc}")
        return

    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select("a.link-dark-fg")

    count = 0
    for card in cards:
        if count >= max_per_source:
            break

        href = (card.get("href") or "").strip()
        if not href:
            continue
        link = href if href.startswith("http") else f"https://www.harrisx.com{href}"

        key = hashlib.md5(link.lower().encode()).hexdigest()
        if key in seen:
            continue

        title_el = card.select_one("h5.black-text")
        title = title_el.get_text(strip=True) if title_el else ""
        if not title:
            continue

        summary_el = card.select_one("p.paragraph-75")
        summary = _clean_html(summary_el.get_text(strip=True)) if summary_el else ""

        pub_date = None
        for candidate in card.select("div.media-info-div p.text-sm"):
            pub_date = _parse_html_date(candidate.get_text(strip=True))
            if pub_date:
                break

        if pub_date and pub_date < cutoff:
            continue

        seen.add(key)
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

    previous_timeout = socket.getdefaulttimeout()
    socket.setdefaulttimeout(FEED_TIMEOUT_SECONDS)
    try:
        _collect(sources, cutoff, max_per_source, seen, articles)
    finally:
        socket.setdefaulttimeout(previous_timeout)

    # Sort newest first, then strip internal sort key
    articles.sort(key=lambda a: a["_pub_dt"], reverse=True)
    for a in articles:
        del a["_pub_dt"]

    return articles


def _collect(
    sources: list[dict],
    cutoff: datetime,
    max_per_source: int,
    seen: set[str],
    articles: list[dict],
) -> None:
    for source in sources:
        # Skip comment/section-marker entries and disabled sources
        if "_section" in source or source.get("_disabled"):
            continue

        # Sources with no feed at all (e.g. HarrisX) are scraped directly
        # instead of going through feedparser.
        if source.get("type") == "html":
            _fetch_html_source(source, cutoff, max_per_source, seen, articles)
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
