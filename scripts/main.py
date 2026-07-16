"""Org news digest pipeline — entry point for GitHub Actions."""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

from fetcher import fetch_all_sources
from digest_generator import generate_digest
from email_sender import send_digest_email


REPO_ROOT = Path(__file__).parent.parent
OUTPUTS_DIR = REPO_ROOT / "outputs"
CONFIG_PATH = REPO_ROOT / "config" / "digest_config.json"
SOURCES_PATH = REPO_ROOT / "config" / "sources.json"


def load_json(path: Path) -> dict:
    with open(path) as f:
        return json.load(f)


def unique_output_path(base: Path) -> Path:
    if not base.exists():
        return base
    stem, suffix, parent = base.stem, base.suffix, base.parent
    for n in range(2, 30):
        candidate = parent / f"{stem} (Part {n}){suffix}"
        if not candidate.exists():
            return candidate
    return base


def main() -> None:
    # ── Environment ──────────────────────────────────────────────────────────
    anthropic_api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    resend_api_key = os.environ.get("RESEND_API_KEY", "")

    if not anthropic_api_key:
        sys.exit("ERROR: ANTHROPIC_API_KEY is not set.")

    # ── Config ───────────────────────────────────────────────────────────────
    config = load_json(CONFIG_PATH)
    days_back = config.get("days_back", 2)
    max_per_source = config.get("max_items_per_source", 20)
    min_items = config.get("min_items_to_send", 1)
    to_email = config.get("to_email", "")
    from_email = config.get("from_email", "Org News Digest <onboarding@resend.dev>")
    model = config.get("model", "claude-opus-4-5")

    # ── Sources ───────────────────────────────────────────────────────────────
    sources_data = load_json(SOURCES_PATH)
    sources = sources_data.get("sources", [])
    # Filter out section-marker entries (they have a _section key)
    active_sources = [s for s in sources if "feed_url" in s]

    run_date = datetime.now().strftime("%Y-%m-%d")

    print(f"\n{'=' * 60}")
    print(f"Org News Digest Pipeline — {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"Sources : {len(active_sources)}")
    print(f"Lookback: {days_back} day(s)")
    print(f"{'=' * 60}\n")

    OUTPUTS_DIR.mkdir(exist_ok=True)

    # ── Step 1: Fetch articles ────────────────────────────────────────────────
    print("Fetching from all sources...")
    articles = fetch_all_sources(
        sources=active_sources,
        days_back=days_back,
        max_per_source=max_per_source,
    )
    print(f"\nTotal items after deduplication: {len(articles)}")

    if len(articles) < min_items:
        print(f"Fewer than {min_items} item(s) found — skipping digest and email.")
        sys.exit(0)

    # ── Step 2: Generate digest ───────────────────────────────────────────────
    print("\nGenerating digest with Claude...")
    digest_content = generate_digest(
        articles=articles,
        source_count=len(active_sources),
        api_key=anthropic_api_key,
        model=model,
    )
    print("Digest generated.")

    # Save digest
    digest_filename = f"Org News Digest — {run_date}.md"
    digest_path = unique_output_path(OUTPUTS_DIR / digest_filename)
    digest_path.write_text(digest_content, encoding="utf-8")
    print(f"Digest saved: outputs/{digest_path.name}")

    # ── Step 3: Send email ────────────────────────────────────────────────────
    if to_email and resend_api_key:
        print("\nSending email...")
        send_digest_email(
            to_email=to_email,
            from_email=from_email,
            run_date=run_date,
            item_count=len(articles),
            source_count=len(active_sources),
            digest_content=digest_content,
            resend_api_key=resend_api_key,
        )
        print(f"Email sent to {to_email}")
    else:
        print("\nSkipping email — RESEND_API_KEY or to_email not configured.")

    print("\nDone ✓")


if __name__ == "__main__":
    main()
