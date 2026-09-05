"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { usDate } from "@/lib/dates";
import type { DateSummary } from "@/lib/db";

const SEARCH_DEBOUNCE_MS = 300;

export default function Dashboard({
  dates,
  activeDate,
  query,
  showArchived,
  children,
}: {
  dates: DateSummary[];
  activeDate: string | null;
  query: string;
  showArchived: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The back-to-top button lives in ScrollTopButton, mounted alongside this
  // component in page.tsx. There was a second copy here with its own listener
  // and its own threshold, both carrying id="scroll-top-btn" -- two elements
  // sharing one id, stacked on the same coordinates past 400px, announced twice.
  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  // Searching re-queries Postgres rather than filtering in the browser, so the
  // date being viewed is dropped and the newest match takes over.
  function onSearchChange(value: string) {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const term = value.trim();
      const params = new URLSearchParams();
      if (term) params.set("q", term);
      if (showArchived) params.set("archived", "1");
      const qs = params.toString();
      router.replace(qs ? `/?${qs}` : "/");
    }, SEARCH_DEBOUNCE_MS);
  }

  function dateHref(runDate: string) {
    const params = new URLSearchParams({ date: runDate });
    if (query) params.set("q", query);
    if (showArchived) params.set("archived", "1");
    return `/?${params.toString()}`;
  }

  function archivedToggleHref() {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (!showArchived) params.set("archived", "1");
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="controls">
          <input
            type="search"
            aria-label="Search digests by date or content"
            placeholder="Search date or content…"
            defaultValue={query}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <Link href={archivedToggleHref()} scroll={false} className="archived-toggle">
            {showArchived ? "← Back to active digests" : "View archived"}
          </Link>
        </div>
        <div className="run-count">
          {dates.length} {dates.length === 1 ? "day" : "days"}
          {query ? " matching" : ""}
          {showArchived ? " (archived)" : ""}
        </div>
        <div className="run-list">
          {dates.length === 0 ? (
            <div className="empty-state">No runs match.</div>
          ) : (
            dates.map((d) => (
              <Link
                key={d.run_date}
                href={dateHref(d.run_date)}
                scroll={false}
                className={`run-card ${d.run_date === activeDate ? "active" : ""}`}
                aria-current={d.run_date === activeDate ? "true" : undefined}
              >
                <div className="rc-title">{usDate(d.run_date)}</div>
                <div className="rc-meta">
                  {d.press_runs > 0 && (
                    <span className="badge">
                      Press &middot; {d.press_items}
                      {d.press_runs > 1 ? ` (${d.press_runs} runs)` : ""}
                    </span>
                  )}
                  {d.org_runs > 0 && (
                    <span className="badge">
                      Org &middot; {d.org_items}
                      {d.org_runs > 1 ? ` (${d.org_runs} runs)` : ""}
                    </span>
                  )}
                </div>
              </Link>
            ))
          )}
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
