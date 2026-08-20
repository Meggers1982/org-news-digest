"""Combined news digest pipeline — entry point for GitHub Actions.

Runs two independent curation passes each invocation:
  - "org"   — pitch-angle digest for the aging/senior-care/health-policy beat
  - "press" — general consumer/lifestyle press-release highlights

Each pass fetches its own source list, filters out links already seen in the
last `dedup_days` days (tracked in the seen_links table), curates with its
own Claude prompt, and stores the resulting Markdown in digest_runs for the
dashboard to read. No email is sent and no files are committed back to the
repo — Postgres is the only output.
"""

import json
import sys
import traceback
from datetime import date
from pathlib import Path

import db
from fetcher import fetch_all_sources
from org_digest_generator import generate_digest as generate_org_digest
from press_digest_generator import generate_digest as generate_press_digest


REPO_ROOT = Path(__file__).parent.parent
CONFIG_PATH = REPO_ROOT / "config" / "digest_config.json"
ORG_SOURCES_PATH = REPO_ROOT / "config" / "org_sources.json"
PRESS_SOURCES_PATH = REPO_ROOT / "config" / "press_sources.json"
PRESS_PREFERENCES_PATH = REPO_ROOT / "preferences" / "press_preferences.md"


def load_json(path: Path) -> dict:
    with open(path) as f:
        return json.load(f)


def active_sources(sources_data: dict) -> list[dict]:
    return [s for s in sources_data.get("sources", []) if "feed_url" in s]


def run_pipeline(
    conn,
    digest_type: str,
    sources: list[dict],
    settings: dict,
    generate_fn,
    run_date: date,
    anthropic_api_key: str,
    **generate_kwargs,
) -> None:
    print(f"\n{'=' * 60}")
    print(f"{digest_type.upper()} digest — sources: {len(sources)}, lookback: {settings['days_back']}d")
    print(f"{'=' * 60}")

    seen = db.load_seen_links(conn, digest_type)
    articles = fetch_all_sources(
        sources=sources,
        days_back=settings["days_back"],
        max_per_source=settings["max_items_per_source"],
    )
    # Entries with no link can't be deduped across runs — keep them rather
    # than letting them collide with each other on the empty string.
    articles = [a for a in articles if not a["link"] or a["link"] not in seen]
    print(f"{digest_type}: {len(articles)} new item(s) after dedup")

    if len(articles) < settings["min_items_to_send"]:
        print(f"{digest_type}: fewer than {settings['min_items_to_send']} item(s) — skipping this pass.")
        return

    markdown = generate_fn(
        articles=articles,
        source_count=len(sources),
        api_key=anthropic_api_key,
        model=settings["model"],
        **generate_kwargs,
    )

    db.insert_digest_run(
        conn,
        run_date=run_date,
        digest_type=digest_type,
        source_count=len(sources),
        item_count=len(articles),
        markdown=markdown,
    )
    db.record_seen_links(conn, digest_type, [a["link"] for a in articles])
    print(f"{digest_type}: digest stored ({len(articles)} items).")


def main() -> None:
    import os

    anthropic_api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not anthropic_api_key:
        sys.exit("ERROR: ANTHROPIC_API_KEY is not set.")
    if not os.environ.get("DATABASE_URL"):
        sys.exit("ERROR: DATABASE_URL is not set.")

    config = load_json(CONFIG_PATH)
    dedup_days = config.get("dedup_days", 7)
    run_date = date.today()

    conn = db.get_connection()
    db.ensure_schema(conn)
    db.prune_seen_links(conn, dedup_days)

    org_sources = active_sources(load_json(ORG_SOURCES_PATH))
    press_sources = active_sources(load_json(PRESS_SOURCES_PATH))
    preferences = PRESS_PREFERENCES_PATH.read_text().strip() if PRESS_PREFERENCES_PATH.exists() else ""

    # Each pass is isolated: a failure in one (a feed outage, an API error
    # that outlasts the retries) must not stop the other from running.
    failures = []
    for digest_type, sources, settings, generate_fn, kwargs in (
        ("org", org_sources, config["org"], generate_org_digest, {}),
        ("press", press_sources, config["press"], generate_press_digest, {"preferences": preferences}),
    ):
        try:
            run_pipeline(
                conn, digest_type, sources, settings, generate_fn,
                run_date, anthropic_api_key, **kwargs,
            )
        except Exception as exc:
            conn.rollback()
            failures.append(digest_type)
            print(f"✗ {digest_type}: pass failed — {type(exc).__name__}: {exc}")
            traceback.print_exc()

    conn.close()

    if failures:
        sys.exit(f"\nFailed pass(es): {', '.join(failures)}")
    print("\nDone ✓")


if __name__ == "__main__":
    main()
