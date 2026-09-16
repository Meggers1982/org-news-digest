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

Two more optional keys cover sites that need special handling:

- `"browser_user_agent": true` sends a browser User-Agent instead of the default
  `org-news-digest/1.0`, for sites whose CDN or firewall rejects the default (the
  FTC and NIA feeds).
- `"type": "who_api"` with `"url"` and `"news_types"` reads WHO's JSON news API
  through `_fetch_who_source`, keeping only the listed `NewsType` values (news
  releases and statements today). WHO's RSS feed stopped updating in early 2026.

A source is fetched when it isn't `_disabled` and has either a `feed_url` or a `url`.

The org pass's Government & Policy sources include agency-wide news-release feeds
from CDC, the Department of Labor, CMS, FDA, NIH, the FTC, the CFPB, and WHO
(news releases and statements). These cover every topic the agency
handles, so `org_digest_generator.py`'s prompt tells Claude to keep only releases
tied to older adults, family caregivers, or the long-term care workforce.

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

These are skipped with a warning rather than failing the run:

- Commonwealth Fund's RSS returns malformed XML. As of 2026-09-16 it is worse:
  the feed answers with a Cloudflare challenge page, and so does the `/rss-feeds`
  listing that would name an alternative, so there is nothing to switch to.
- The CareScout/Genworth Business Wire search feed returns HTML instead of XML.
  PR Newswire's `?q=carescout` search feed is **not** a substitute: it returns
  valid RSS while ignoring `q=` entirely, so it would quietly deliver the whole
  PR Newswire firehose and look healthier than the failure it replaced.

**A feed that fails is retried once** after `RETRY_PAUSE_SECONDS`, and if it
still isn't a feed the warning now carries the HTTP status, the content type and
the first 200 characters of the body (`_parse_feed` / `_describe_failure`,
MEA-734). "syntax error" alone read the same for a rate-limit page, an empty
body and a redirect to HTML, which are three different problems. The extra
request only happens on a failure, never on a healthy feed.

Handled in `fetcher.py`, not skipped:

- CMS's newsroom feed wraps titles in `<a>` tags and puts URL-encoded markup in
  `<link>`. `_entry_link` recovers the real URL from the title.
- NIH and CMS date items as `Mon, 09/14/2026 - 11:00`, which feedparser can't read.
  `_FALLBACK_DATE_FORMATS` parses it so those items respect the lookback cutoff.
- CDC item links are `tools.cdc.gov` download URLs that redirect to the cdc.gov
  release page.

Disabled in `config/org_sources.json`: HHS and Social Security news releases, which
return an Akamai "Access Denied" (403) both locally and from GitHub Actions; the
Administration for Community Living, which has no working feed; and **NIA**
(2026-09-16, MEA-733).

NIA is the one worth remembering, because it was re-enabled on the strength of a
check that ran in the wrong place. Its feed answers a browser user agent on a
home machine and refuses the same agent from GitHub Actions, because the AWS WAF
scores the datacenter IP too — so it failed every morning while looking fine
locally. **Verify a feed from an Actions run before re-enabling it.** Little is
lost: the general News Feed's newest item is from 2026-02-27, and NIA research
releases arrive through the NIH News Releases source.
