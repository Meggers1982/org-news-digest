import { getRunsForDate, isValidDate } from "@/lib/db";
import { parseDigestItems, toCsv } from "@/lib/digestItems";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LABELS = { press: "Press Highlights", org: "Org Watch" } as const;

/** One row per item across the day's runs -- the .csv export the other digest
 *  dashboards have, so a day's picks can go into a sheet without copying. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const date = params.get("date") ?? "";
  if (!isValidDate(date)) return new Response("Invalid date", { status: 400 });

  const runs = await getRunsForDate(date, params.get("archived") === "1");
  const rows = [["date", "digest", "run_time", "section", "headline", "summary", "source", "url"]];
  for (const run of runs) {
    for (const item of parseDigestItems(run.digest_type, run.markdown)) {
      rows.push([date, LABELS[run.digest_type], run.run_time, item.section, item.headline,
        item.summary, item.source, item.url]);
    }
  }

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${date}-news-digest.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
