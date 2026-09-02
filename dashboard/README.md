# News Digest dashboard

Next.js app that reads digest runs straight out of Neon Postgres and renders
them. Live at **https://news-digest-ivory.vercel.app** (unlisted, no auth).
Pipeline that fills the database: see the [repo README](../README.md).

## Architecture

One dynamic route. `app/page.tsx` is a Server Component that reads `?date=` and
`?q=` from the URL, so the browser only ever receives the day being viewed:

- **Sidebar** — `getDateIndex(q)` returns one row per date with run and item
  counts, and **no markdown**. Search is a Postgres `ilike`, not a client-side
  filter, so the full corpus never crosses the wire.
- **Content** — `getRunsForDate(date)` returns every run stored for that date,
  newest first, excluding archived runs unless `?archived=1` is set. Markdown is
  rendered to HTML in `DigestSection` (a Server Component), keeping
  `react-markdown` out of the client bundle entirely. When a run has `trends_raw`,
  `feature_pitch_raw`, and/or `item_pitches_raw`, they render as callout
  `.section-block`s below the main digest.
- **Client** — `Dashboard.tsx` is a thin shell: the debounced search box, the
  date links, the archived-view toggle, and the back-to-top button. `RunActions`
  is a small separate client island (per-run Archive/Unarchive and Delete
  buttons) so `DigestSection` itself can stay a Server Component.

A date can hold more than one run per digest type, because re-dispatching the
workflow mid-day yields a second partial digest. All of them render, each
labelled with its run time, rather than one silently shadowing the others.

Pages are `force-dynamic` — Postgres is the source of truth and traffic is tiny.

### Routes

| Route | Purpose |
|---|---|
| `/` | Dashboard. `?date=YYYY-MM-DD` selects a day, `?q=` searches content, `?archived=1` shows archived runs instead of active ones |
| `/api/docx?id=<run id>` | Downloads that run as a Word document |
| `/api/runs/<run id>` (PATCH) | Body `{ archived: boolean }` — archive/unarchive a run |
| `/api/runs/<run id>` (DELETE) | Permanently deletes a run |

`.docx` export runs server-side (`lib/markdownToDocx.ts` + `docx`), so the
library stays off the client. It includes the run's `trends_raw`,
`feature_pitch_raw`, and `item_pitches_raw` sections when present, matching
what's shown on the page.

## Local development

`DATABASE_URL` must be in `.env.local` (gitignored):

```bash
npm install
npm run dev
```

`npm run build` and `npx eslint .` should both pass before deploying.

## Deploying

Vercel project `news-digest` under team `meagan-morris-projects`, with
Root Directory set to `dashboard` and the `.vercel` link at the **repo root**.

Pushing to `main` deploys to production via the Vercel Git integration. To
deploy by hand, run from the repo root (not from `dashboard/` — the link lives
at the root, and running from here makes Vercel look for `dashboard/dashboard`):

```bash
npx vercel --prod          # production
npx vercel                 # preview build, safe to test with
```

Before 2026-08-21 the Root Directory was the repo root while the app lived in
`dashboard/`, so every push kicked off a build that failed with "Couldn't find
any `pages` or `app` directory" and emailed a deployment-failure notice. If
those emails come back, check Root Directory first.

## Schema

The table is defined and migrated by `scripts/db.py` (`ensure_schema`, run at the
start of every pipeline run). The dashboard reads it as normal, but `archived_at`
is the one column the dashboard itself writes to, via `lib/db.ts`'s
`setRunArchived`/`deleteRun` and the `/api/runs/<id>` route.

```sql
digest_runs   (id, run_date, digest_type, source_count, item_count, markdown,
               trends_raw, feature_pitch_raw, item_pitches_raw, archived_at,
               created_at)
seen_links    (link, digest_type, first_seen)
digest_memory (digest_type, memory, updated_at)
```

`item_count` is how many items were **fetched** for that run after dedup, not how
many the curator kept — the UI labels it "items fetched" for that reason.

`trends_raw`, `feature_pitch_raw`, and `item_pitches_raw` are written by
`scripts/trends_generator.py` after the digest itself: comparing it against the
prior digest of the same type, looking for a cross-item pattern worth pitching as
a standalone feature, and giving individually storyworthy items their own
one-line pitch angle. All three are nullable — older rows and rows where that
step failed just render without those sections, no schema branching needed in
the UI beyond a truthiness check. `digest_memory` holds one running synthesis row
per digest type that `trends_generator.py` reads and revises each run; the
dashboard never reads it directly.

`archived_at` is null for an active run and set to the archive timestamp
otherwise. Archiving is a soft hide — `getDateIndex`/`getRunsForDate` exclude
archived runs by default and the dashboard's "View archived" link passes
`includeArchived: true` to see them again. Deleting a run removes the row
outright and cannot be undone from the UI.

> Neon returns `date` / `timestamptz` columns as JS `Date` objects, not strings.
> Every query here casts them (`run_date::text`, `to_char(created_at …)`), and new
> queries must too — the TypeScript annotation does not enforce it, and rendering
> a raw `Date` in JSX throws at runtime.
