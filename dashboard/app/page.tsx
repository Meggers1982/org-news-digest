import { getDateIndex, getRunsForDate, type DigestRun } from "@/lib/db";
import Dashboard from "./components/Dashboard";
import DigestSection from "./components/DigestSection";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** Press before Org; newest first within each type (rows arrive created_at desc). */
function orderRuns(runs: DigestRun[]): DigestRun[] {
  return [...runs].sort((a, b) => {
    if (a.digest_type === b.digest_type) return 0;
    return a.digest_type === "press" ? -1 : 1;
  });
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const query = firstParam(params.q).trim();
  const requestedDate = firstParam(params.date);

  const dates = await getDateIndex(query);
  const activeDate = dates.some((d) => d.run_date === requestedDate)
    ? requestedDate
    : (dates[0]?.run_date ?? null);

  const runs = activeDate ? orderRuns(await getRunsForDate(activeDate)) : [];
  const summary = activeDate ? dates.find((d) => d.run_date === activeDate) : undefined;

  return (
    <>
      <header className="app-header">
        <h1>News Digest</h1>
        <p>Full run history — press highlights and org watch, browsable by date.</p>
      </header>
      <Dashboard dates={dates} activeDate={activeDate} query={query}>
        {activeDate ? (
          <>
            <div className="run-header">
              <h2>{activeDate}</h2>
              <div className="meta-row">
                <span>
                  Press:{" "}
                  {summary && summary.press_runs > 0
                    ? `${summary.press_items} items across ${summary.press_runs} run${summary.press_runs > 1 ? "s" : ""}`
                    : "—"}
                </span>
                <span>
                  Org:{" "}
                  {summary && summary.org_runs > 0
                    ? `${summary.org_items} items across ${summary.org_runs} run${summary.org_runs > 1 ? "s" : ""}`
                    : "—"}
                </span>
              </div>
            </div>
            {runs.map((run) => (
              <DigestSection
                key={run.id}
                run={run}
                showTime={
                  runs.filter((r) => r.digest_type === run.digest_type).length > 1
                }
              />
            ))}
          </>
        ) : (
          <div className="empty-state">
            {query ? "No runs match that search." : "No digests have been stored yet."}
          </div>
        )}
      </Dashboard>
    </>
  );
}
