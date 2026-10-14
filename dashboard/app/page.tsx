import { getDateIndex, getRunsForDate, type DigestRun } from "@/lib/db";
import { usDate } from "@/lib/dates";
import Dashboard from "./components/Dashboard";
import DigestSection, { LABELS } from "./components/DigestSection";
import ScrollTopButton from "./components/ScrollTopButton";
import ThemeToggle from "./components/ThemeToggle";

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

/** Same tile as senior-research-digest's stat row; a zero greys out rather
 *  than shouting in the accent color. */
function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className={`stat${n === 0 ? " is-zero" : ""}`}>
      <div className="n">{n}</div>
      <div className="l">{label}</div>
    </div>
  );
}

/** Sources are counted per run; a feed that fed both digests counts once per
 *  digest, which is what "monitored" meant on each run card already. */
function sourceCount(runs: DigestRun[]): number {
  return runs.reduce((total, r) => total + r.source_count, 0);
}

function csvHref(date: string, archived: boolean): string {
  const params = new URLSearchParams({ date });
  if (archived) params.set("archived", "1");
  return `/api/csv?${params.toString()}`;
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const query = firstParam(params.q).trim();
  const requestedDate = firstParam(params.date);
  const showArchived = firstParam(params.archived) === "1";

  const dates = await getDateIndex(query, undefined, showArchived);
  const activeDate = dates.some((d) => d.run_date === requestedDate)
    ? requestedDate
    : (dates[0]?.run_date ?? null);

  const runs = activeDate ? orderRuns(await getRunsForDate(activeDate, showArchived)) : [];
  const summary = activeDate ? dates.find((d) => d.run_date === activeDate) : undefined;

  return (
    <>
      <header className="app-header">
        <div>
          <h1>News Digest</h1>
          <p>Full run history — press highlights and org watch, browsable by date.</p>
        </div>
        <ThemeToggle />
      </header>
      <Dashboard dates={dates} activeDate={activeDate} query={query} showArchived={showArchived}>
        {activeDate ? (
          <>
            <div className="run-header">
              <div className="run-header-top">
                <h2>News Digest — {usDate(activeDate)}</h2>
                <div className="btn-row">
                  <a className="export-btn" href={csvHref(activeDate, showArchived)}>
                    Export .csv
                  </a>
                </div>
              </div>
              <div className="stat-row">
                <Stat n={summary?.press_items ?? 0} label="press items fetched" />
                <Stat n={summary?.org_items ?? 0} label="org items fetched" />
                <Stat n={sourceCount(runs)} label="sources monitored" />
                <Stat n={runs.length} label={runs.length === 1 ? "digest run" : "digest runs"} />
              </div>
              {runs.length > 1 && (
                <nav className="jump-links" aria-label="Jump to a digest">
                  {runs.map((run) => (
                    <a key={run.id} className="jump-link" href={`#run-${run.id}`}>
                      {LABELS[run.digest_type]}
                      {runs.filter((r) => r.digest_type === run.digest_type).length > 1
                        ? ` · ${run.run_time}`
                        : ""}{" "}
                      &darr;
                    </a>
                  ))}
                </nav>
              )}
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
            {query
              ? "No runs match that search."
              : showArchived
                ? "No archived digests."
                : "No digests have been stored yet."}
          </div>
        )}
      </Dashboard>
      <ScrollTopButton />
    </>
  );
}
