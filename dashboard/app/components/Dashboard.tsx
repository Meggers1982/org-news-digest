"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { DateSummary } from "@/lib/db";

const SEARCH_DEBOUNCE_MS = 300;

export default function Dashboard({
  dates,
  activeDate,
  query,
  children,
}: {
  dates: DateSummary[];
  activeDate: string | null;
  query: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  // Searching re-queries Postgres rather than filtering in the browser, so the
  // date being viewed is dropped and the newest match takes over.
  function onSearchChange(value: string) {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const term = value.trim();
      router.replace(term ? `/?q=${encodeURIComponent(term)}` : "/");
    }, SEARCH_DEBOUNCE_MS);
  }

  function dateHref(runDate: string) {
    const params = new URLSearchParams({ date: runDate });
    if (query) params.set("q", query);
    return `/?${params.toString()}`;
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
        </div>
        <div className="run-count">
          {dates.length} {dates.length === 1 ? "day" : "days"}
          {query ? " matching" : ""}
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
                <div className="rc-title">{d.run_date}</div>
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
      {showScrollTop && (
        <button
          id="scroll-top-btn"
          title="Back to top"
          aria-label="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          &#8593;
        </button>
      )}
    </div>
  );
}
