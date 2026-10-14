"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

export const THEME_KEY = "digest-theme";

type Choice = "system" | "light" | "dark";
const CHOICES: Choice[] = ["system", "light", "dark"];
const LABEL: Record<Choice, string> = {
  system: "Theme: Auto",
  light: "Theme: Light",
  dark: "Theme: Dark",
};

function prefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function currentChoice(): Choice {
  const stored = document.documentElement.dataset.themeChoice;
  return CHOICES.includes(stored as Choice) ? (stored as Choice) : "system";
}

const CHANGE_EVENT = "digest:theme-change";

function apply(choice: Choice) {
  const root = document.documentElement;
  root.dataset.theme = choice === "dark" || (choice === "system" && prefersDark()) ? "dark" : "light";
  root.dataset.themeChoice = choice;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

/**
 * The same three-state control as senior-research-digest: Auto follows the OS,
 * Light and Dark pin it. A two-state toggle cannot get back to "follow the OS"
 * once clicked, which is where most people start.
 *
 * The choice is only knowable on the client, so the server snapshot is Auto
 * and useSyncExternalStore swaps in the stored choice after hydration --
 * rendering it directly would be a hydration mismatch. THEME_INIT in layout.tsx has
 * already painted the right palette, so only the label text moves.
 */
export default function ThemeToggle() {
  const choice = useSyncExternalStore(subscribe, currentChoice, () => "system" as Choice);

  useEffect(() => {
    // While on Auto, follow the OS as it changes rather than only at load.
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (currentChoice() === "system") apply("system");
    };
    mq?.addEventListener("change", onChange);
    return () => mq?.removeEventListener("change", onChange);
  }, []);

  const cycle = useCallback(() => {
    const next = CHOICES[(CHOICES.indexOf(currentChoice()) + 1) % CHOICES.length];
    apply(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private browsing denies storage; the toggle still works for this page view.
    }
  }, []);

  const following = CHOICES[(CHOICES.indexOf(choice) + 1) % CHOICES.length];
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cycle}
      aria-label={`Theme: ${choice}. Activate to switch to ${following}.`}
    >
      {LABEL[choice]}
    </button>
  );
}
