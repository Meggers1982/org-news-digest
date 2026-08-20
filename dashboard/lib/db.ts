import { neon } from "@neondatabase/serverless";

export type DigestType = "press" | "org";

export type DigestRun = {
  id: number;
  run_date: string;
  digest_type: DigestType;
  source_count: number;
  item_count: number;
  markdown: string;
  created_at: string;
};

function sql() {
  return neon(process.env.DATABASE_URL!);
}

export async function getLatestRun(digestType: DigestType): Promise<DigestRun | null> {
  const rows = await sql()`
    select id, run_date::text as run_date, digest_type, source_count, item_count, markdown, created_at::text as created_at
    from digest_runs
    where digest_type = ${digestType}
    order by run_date desc, created_at desc
    limit 1
  `;
  return (rows[0] as DigestRun) ?? null;
}

export async function getAllRuns(limit = 400): Promise<DigestRun[]> {
  const rows = await sql()`
    select id, run_date::text as run_date, digest_type, source_count, item_count, markdown, created_at::text as created_at
    from digest_runs
    order by run_date desc, created_at desc
    limit ${limit}
  `;
  return rows as DigestRun[];
}
