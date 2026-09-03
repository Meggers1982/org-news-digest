"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

const COLLAPSE_KEY = "digest-collapsed";

function readCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set<string>();
  }
}

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
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // A link straight to this section must open it, or the jump looks broken.
    if (window.location.hash === `#${id}`) return;
    setCollapsed(readCollapsed().has(id));
  }, [id]);

  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === `#${id}`) setCollapsed(false);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [id]);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      const set = readCollapsed();
      if (next) set.add(id);
      else set.delete(id);
      persist(set);
      return next;
    });
  }, [id]);

  return (
    <section className={`section-block${collapsed ? " collapsed" : ""}`} id={id}>
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
        </button>
      </h4>
      <div className="section-body" id={`${id}-body`}>
        {children}
      </div>
    </section>
  );
}
