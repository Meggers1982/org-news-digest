"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

const COLLAPSE_KEY = "digest-collapsed";

/* Section ids carry the run they belong to (trends-41), so the stored set grew
   by one entry per section per run forever, and collapsing Trends on one date
   said nothing about the next. Both are fixed by storing the kind rather than
   the instance: four possible entries, and the preference is what you meant --
   "keep Trends shut", not "keep Trends shut on run 41". */
function kindOf(id: string): string {
  return id.replace(/-\d+$/, "");
}

function readCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set<string>();
  }
}

/** Fired by CollapseAllButton; every section in the group obeys it. */
export const SET_COLLAPSED_EVENT = "digest:set-collapsed";
/** Fired by a section after it changes, so the button can relabel itself. */
export const SECTION_CHANGED_EVENT = "digest:section-changed";

export type SetCollapsedDetail = { group: string; collapsed: boolean };

function persist(set: Set<string>) {
  try {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...set]));
  } catch {
    // Private browsing denies storage; collapsing still works for this view.
  }
}

/**
 * Client wrapper around server-rendered section content.
 *
 * `children` is rendered on the server and passed through, so react-markdown
 * stays out of the browser bundle — the reason DigestSection is a server
 * component in the first place.
 *
 * Always renders expanded on the server and corrects in an effect: the stored
 * state lives in localStorage, so rendering it directly would be a hydration
 * mismatch.
 */
export default function CollapsibleSection({
  id,
  title,
  group,
  extraClass,
  children,
}: {
  id: string;
  title: string;
  /** Sections sharing a group answer to one Collapse all button. */
  group: string;
  extraClass?: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // A link straight to this section must open it, or the jump looks broken.
    if (window.location.hash === `#${id}`) return;
    setCollapsed(readCollapsed().has(kindOf(id)));
  }, [id]);

  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === `#${id}`) setCollapsed(false);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [id]);

  const setAndPersist = useCallback(
    (next: boolean) => {
      setCollapsed(next);
      const set = readCollapsed();
      if (next) set.add(kindOf(id));
      else set.delete(kindOf(id));
      persist(set);
    },
    [id],
  );

  useEffect(() => {
    const onSetAll = (e: Event) => {
      const detail = (e as CustomEvent<SetCollapsedDetail>).detail;
      if (detail.group === group) setAndPersist(detail.collapsed);
    };
    window.addEventListener(SET_COLLAPSED_EVENT, onSetAll);
    return () => window.removeEventListener(SET_COLLAPSED_EVENT, onSetAll);
  }, [group, setAndPersist]);

  // Announced after the class has landed in the DOM, which is what the
  // Collapse all button reads to pick its label.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(SECTION_CHANGED_EVENT, { detail: { group } }));
  }, [collapsed, group]);

  const toggle = useCallback(() => setAndPersist(!collapsed), [collapsed, setAndPersist]);

  return (
    <section
      className={`section-block${extraClass ? ` ${extraClass}` : ""}${collapsed ? " collapsed" : ""}`}
      id={id}
      data-group={group}
    >
      <h4>
        <button
          type="button"
          className="section-toggle"
          aria-expanded={!collapsed}
          aria-controls={`${id}-body`}
          onClick={toggle}
        >
          <span className="section-caret" aria-hidden="true">
            &#9662;
          </span>
          {title}
          <span className="section-hint">{collapsed ? "SHOW" : "HIDE"}</span>
        </button>
      </h4>
      <div className="section-body" id={`${id}-body`}>
        {children}
      </div>
    </section>
  );
}
