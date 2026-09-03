"use client";

import { useCallback } from "react";

export const THEME_KEY = "digest-theme";

/**
 * Matches the toggle in senior-research-digest and agingwire-research-intelligence.
 *
 * The label is deliberately static rather than reflecting the current theme:
 * the theme is only knowable on the client, and a label that differs between
 * server and client render is a hydration mismatch.
 */
export default function ThemeToggle() {
  const toggle = useCallback(() => {
    const root = document.documentElement;
    const current =
      root.dataset.theme ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private browsing denies storage; the toggle still works for this page view.
    }
  }, []);

  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label="Toggle color theme">
      Theme
    </button>
  );
}
