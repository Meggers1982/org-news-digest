# org-news-digest

A daily news pipeline for a freelance journalist covering aging, senior care, and
elder health. One scheduled run produces two independent digests, stores them in
Postgres, and serves them from a small web dashboard. There is no email.

- **`org`** — pitch-angle digest for the aging / senior-care / health-policy beat,
  curated from government agencies, advocacy groups, think tanks, and industry
  associations. Each item gets consumer and trade story angles.
- **`press`** — general consumer/lifestyle press-release highlights from Business
  Wire and PR Newswire, filtered by `preferences/press_preferences.md`.

## Dashboard palette

The color tokens in `dashboard/app/dashboard.css` are shared with
`senior-research-digest` and `agingwire-research-intelligence` so the three
dashboards read as one family. Change them in all three or in none.

The theme toggle writes `data-theme` to the root element and remembers the
choice in `localStorage` under `digest-theme`. An inline script in
`app/layout.tsx` applies the stored value before first paint — without it a
stored dark preference flashes light on every load. The button label is static
("Theme") rather than reflecting the current theme, because the theme is only
knowable on the client and a differing label would be a hydration mismatch.

A back-to-top button appears after 240px of scroll, matching the other two.

Each digest section collapses from its heading, with the collapsed set stored in
`localStorage` under `digest-collapsed`. `CollapsibleSection` is a thin client
wrapper: the markdown inside it is still rendered on the server and passed
through as children, which is why `DigestSection` stays a server component and
react-markdown stays out of the browser bundle. It renders expanded on the
server and corrects in an effect, since the stored state is only readable on the
client. A link to a collapsed section opens it.

## How it works

```
GitHub Actions (13:00 UTC daily)
  └─ scripts/main.py
       ├─ fetcher.py          RSS/Atom fetch, per-source caps, date cutoff, wire-feed org filter
       ├─ db.py               Neon Postgres: digest_runs (output) + seen_links (cross-run dedup)
       ├─ org_digest_generator.py     one Claude call → Markdown
       ├─ press_digest_generator.py   one Claude call → Markdown
       └─ trends_generator.py         one Claude call → Trends & Continuity + Feature Pitch
                                          + Story Spotlight + Story Ideas by Item
                                          │
                                          ▼
                              dashboard/ (Next.js on Vercel)
```

Each pass fetches its own sources, drops links seen within `dedup_days`, curates
with its own Claude prompt, and writes the rendered Markdown to `digest_runs`.
The two passes are isolated — a feed outage or API failure in one does not stop
the other, and the job exits non-zero if either failed.

After a digest is generated, `trends_generator.py` compares it against the most
recent prior digest of the same type and looks across just this run's own items
for a cross-item pattern worth pitching as a standalone feature. It also picks
out 1-3 individual releases that stand on their own as a strong standalone story
idea — because they tie into a thread already tracked in `digest_memory` or are
newsjackable against the current news cycle — and separately gives individually
storyworthy items their own one-line pitch angle, distinct from whatever
consumer/trade angle the digest itself already gave that item. It writes four
optional sections (`trends_raw`, `feature_pitch_raw`, `story_spotlight_raw`,
`item_pitches_raw` on the `digest_runs` row) and revises a running per-digest-type
synthesis in `digest_memory` so later runs can draw on more than just the single
most recent digest. A failure here never costs the digest itself — it's caught in
`run_pipeline` and the digest is stored without those four sections.

Because dedup is global across runs, **re-dispatching the workflow on a day that
already ran produces a partial digest** covering only what is new since the last
run. The dashboard therefore shows every run stored for a date, timestamped,
rather than collapsing them to one.

## Layout

| Path | What it is |
|---|---|
| `scripts/main.py` | Entry point — runs both passes, owns pass isolation |
| `scripts/fetcher.py` | Feed fetching and in-run dedup (20s socket timeout per request) |
| `scripts/db.py` | Schema, `digest_runs` inserts, `seen_links` dedup and pruning, `digest_memory` reads/writes |
| `scripts/claude_api.py` | Shared Claude call wrapper — retries 429/5xx, extracts text blocks, raises on refusal |
| `scripts/*_digest_generator.py` | The two curation prompts |
| `scripts/trends_generator.py` | Cross-run comparison + standalone feature-pitch synthesis, per digest type |
| `config/digest_config.json` | Lookback, per-source caps, minimum item count, model |
| `config/org_sources.json`, `config/press_sources.json` | Feed lists |
| `preferences/press_preferences.md` | Freeform steer for the press pass |
| `dashboard/` | Next.js dashboard — see `dashboard/README.md` |

## Configuration

Edit `config/digest_config.json`, commit, and the next run picks it up. Per digest
type: `days_back`, `max_items_per_source`, `min_items_to_send`, `model`. Top level:
`dedup_days`.

Adding a source means adding an object to the relevant `config/*_sources.json` with
at least `name` and `feed_url`. Optional keys: `org`, `category`, `_disabled`, and
`source_filter` (a list of terms used to confirm a wire-search result actually came
from the expected organisation).

For a site with no RSS/Atom feed at all, use `"type": "html"` and `"url"` instead of
`feed_url` — `fetcher.py`'s `_fetch_html_source` scrapes the page directly. This is
source-specific and fragile by nature (see the HarrisX entry in
`config/org_sources.json` for the current example and its markup assumptions); only
reach for it after confirming no feed exists.

## Running it

Requires `ANTHROPIC_API_KEY` and `DATABASE_URL` (both set as GitHub Actions secrets).

```bash
pip install -r requirements.txt
cd scripts && python main.py
```

This writes to whatever database `DATABASE_URL` points at, so use a scratch
database rather than production when testing.

The schedule and manual trigger live in `.github/workflows/daily-digest.yml`. The
job is capped at 30 minutes. The repo is public so that Actions minutes are free.

## Known feed issues

Both are skipped with a warning rather than failing the run:

- Commonwealth Fund's RSS returns malformed XML.
- The CareScout/Genworth PR Newswire search feed returns HTML instead of XML.
