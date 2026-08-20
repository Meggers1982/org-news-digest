import { neon } from "@neondatabase/serverless";

export type DigestType = "press" | "org";

/** One row per date, for the sidebar. Deliberately excludes `markdown` — the
 *  full corpus must never be shipped to the browser just to render a list. */
export type DateSummary = {
  run_date: string;
  press_runs: number;
  org_runs: number;
  press_items: number;
  org_items: number;
};

export type DigestRun = {
  id: number;
  run_date: string;
  digest_type: DigestType;
  source_count: number;
  item_count: number;
  markdown: string;
  /** Cross-run comparison and standalone-feature pitch, both written by
   *  scripts/trends_generator.py. Null when generation failed or predates it. */
  trends_raw: string | null;
  feature_pitch_raw: string | null;
  /** Local-time label, formatted in Postgres so server and client agree. */
  run_time: string;
};

function sql() {
  return neon(process.env.DATABASE_URL!);
}

export function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Dates that have at least one run, newest first, optionally full-text filtered.
 *  Searching happens in Postgres so it stays correct as history grows. */
export async function getDateIndex(query = "", limit = 400): Promise<DateSummary[]> {
  const term = query.trim();
  const like = `%${term}%`;
  const rows = await sql()`
    select
      run_date::text as run_date,
      count(*) filter (where digest_type = 'press')::int as press_runs,
      count(*) filter (where digest_type = 'org')::int as org_runs,
      coalesce(sum(item_count) filter (where digest_type = 'press'), 0)::int as press_items,
      coalesce(sum(item_count) filter (where digest_type = 'org'), 0)::int as org_items
    from digest_runs
    where ${term}::text = ''
       or markdown ilike ${like}
       or run_date::text ilike ${like}
    group by run_date
    order by run_date desc
    limit ${limit}
  `;
  return rows as DateSummary[];
}

/** Every run stored for a date, newest first. A day can hold more than one run
 *  per type when the workflow is re-dispatched; each is a distinct partial
 *  digest (cross-run link dedup means a re-run only sees what is new), so they
 *  are all returned rather than collapsed to one. */
export async function getRunsForDate(runDate: string): Promise<DigestRun[]> {
  if (!isValidDate(runDate)) return [];
  const rows = await sql()`
    select id, run_date::text as run_date, digest_type, source_count, item_count, markdown,
           trends_raw, feature_pitch_raw,
           to_char(created_at at time zone 'America/Chicago', 'HH12:MI AM') as run_time
    from digest_runs
    where run_date = ${runDate}::date
    order by created_at desc
  `;
  return rows as DigestRun[];
}

export async function getRunById(id: number): Promise<DigestRun | null> {
  const rows = await sql()`
    select id, run_date::text as run_date, digest_type, source_count, item_count, markdown,
           trends_raw, feature_pitch_raw,
           to_char(created_at at time zone 'America/Chicago', 'HH12:MI AM') as run_time
    from digest_runs
    where id = ${id}
  `;
  return (rows[0] as DigestRun) ?? null;
}
