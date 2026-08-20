"use client";

import { useEffect, useMemo, useState } from "react";
import type { DigestRun } from "@/lib/db";
import DigestSection from "./DigestSection";

type DateGroup = {
  run_date: string;
  press: DigestRun | null;
  org: DigestRun | null;
};

function groupByDate(runs: DigestRun[]): DateGroup[] {
  const byDate = new Map<string, DateGroup>();
  for (const run of runs) {
    const group = byDate.get(run.run_date) ?? { run_date: run.run_date, press: null, org: null };
    group[run.digest_type] = run;
    byDate.set(run.run_date, group);
  }
  return Array.from(byDate.values()).sort((a, b) => (a.run_date < b.run_date ? 1 : -1));
}

export default function Dashboard({ runs }: { runs: DigestRun[] }) {
  const groups = useMemo(() => groupByDate(runs), [runs]);
  const [query, setQuery] = useState("");
  const [activeDate, setActiveDate] = useState<string | null>(groups[0]?.run_date ?? null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => {
      const haystack = [g.run_date, g.press?.markdown, g.org?.markdown].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [groups, query]);

  useEffect(() => {
    if (!filtered.some((g) => g.run_date === activeDate)) {
      setActiveDate(filtered[0]?.run_date ?? null);
    }
  }, [filtered, activeDate]);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const active = groups.find((g) => g.run_date === activeDate) ?? null;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="controls">
          <input
            type="search"
            placeholder="Search date or content…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="run-count">
          {filtered.length} of {groups.length} runs
        </div>
        <div className="run-list">
          {filtered.length === 0 ? (
            <div className="empty-state">No runs match.</div>
          ) : (
            filtered.map((g) => (
              <div
                key={g.run_date}
                className={`run-card ${g.run_date === activeDate ? "active" : ""}`}
                onClick={() => setActiveDate(g.run_date)}
              >
                <div className="rc-title">{g.run_date}</div>
                <div className="rc-meta">
                  {g.press && <span className="badge">Press &middot; {g.press.item_count}</span>}
                  {g.org && <span className="badge">Org &middot; {g.org.item_count}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
      <main className="content">
        {active ? (
          <>
            <div className="run-header">
              <h2>{active.run_date}</h2>
              <div className="meta-row">
                <span>
                  Press: {active.press ? `${active.press.item_count} items, ${active.press.source_count} sources` : "—"}
                </span>
                <span>
                  Org: {active.org ? `${active.org.item_count} items, ${active.org.source_count} sources` : "—"}
                </span>
              </div>
            </div>
            <DigestSection run={active.press} />
            <DigestSection run={active.org} />
          </>
        ) : (
          <div className="empty-state">Select a run from the list to view its digests.</div>
        )}
      </main>
      <button
        id="scroll-top-btn"
        title="Back to top"
        aria-label="Back to top"
        style={{ display: showScrollTop ? "flex" : "none" }}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        &#8593;
      </button>
    </div>
  );
}
