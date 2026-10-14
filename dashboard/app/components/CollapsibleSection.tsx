"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

/* layout.tsx's pre-paint script reads this key too -- keep the two in step. */
export const COLLAPSE_KEY = "digest-collapsed";

/* Section ids carry the run they belong to (trends-41), so the stored set grew
   by one entry per section per run forever, and collapsing Trends on one date
   said nothing about the next. Both are fixed by storing the kind rather than
   the instance: four possible entries, and the preference is what you meant --
   "keep Trends shut", not "keep Trends shut on run 41". */
function kindOf(id: string): string {
  return id.replace(/-\d+$/, "");
}

/** The raw stored string, so useSyncExternalStore compares by value. */
function readRaw(): string {
  try {
    return localStorage.getItem(COLLAPSE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parse(raw: string): Set<string> {
  try {
    const kinds: unknown = JSON.parse(raw);
    return new Set<string>(Array.isArray(kinds) ? kinds : []);
  } catch {
    return new Set<string>();
  }
}

function readCollapsed(): Set<string> {
  return parse(readRaw());
}

/* Nothing outside this file writes the key while the page is open, and a
   section reads it on its own renders, so there is nothing to subscribe to. */
const subscribeNever = () => () => {};

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
 * The stored state lives in localStorage, which the server cannot read, so
 * the server renders every section expanded. Two things keep that from showing
 * (MEA-53 -- it used to flash open on every load, then snap shut in an effect):
 *
 * - Before first paint, the inline script in layout.tsx copies the stored kinds
 *   onto <html data-collapsed>, and dashboard.css hides those sections while
 *   they lack data-ready. Same pattern as the theme.
 * - On the client, useSyncExternalStore reads the stored set during render with
 *   a server snapshot of null, so hydration matches the server HTML and the
 *   very next render carries the real state and sets data-ready. No effect.
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
  const kind = kindOf(id);
  const stored = useSyncExternalStore(subscribeNever, readRaw, () => null);
  // Set once this section is clicked, collapsed-all, or jumped to; until then
  // it follows the stored preference.
  const [override, setOverride] = useState<boolean | null>(null);
  const ready = stored !== null;
  // A link straight to this section must open it, or the jump looks broken.
  // (`ready` means this is a client render, so window exists.)
  const storedCollapsed =
    ready && parse(stored).has(kind) && window.location.hash !== `#${id}`;
  const collapsed = override ?? storedCollapsed;

  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === `#${id}`) setOverride(false);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [id]);

  const setAndPersist = useCallback(
    (next: boolean) => {
      setOverride(next);
      const set = readCollapsed();
      if (next) set.add(kind);
      else set.delete(kind);
      persist(set);
    },
    [kind, setOverride],
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
      data-kind={kind}
      data-ready={ready ? "" : undefined}
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
          {/* The word comes from CSS so the pre-paint rule can flip it too. */}
          <span className="section-hint" aria-hidden="true" />
        </button>
      </h4>
      <div className="section-body" id={`${id}-body`}>
        {children}
      </div>
    </section>
  );
}
