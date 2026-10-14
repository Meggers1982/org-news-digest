"use client";

import { useEffect, useState } from "react";
import {
  SECTION_CHANGED_EVENT,
  SET_COLLAPSED_EVENT,
  type SetCollapsedDetail,
} from "./CollapsibleSection";

function blocksIn(group: string): Element[] {
  return [...document.querySelectorAll(`.section-block[data-group="${CSS.escape(group)}"]`)];
}

/**
 * The Collapse all / Expand all pill from senior-research-digest. It reads the
 * sections' classes rather than holding its own copy of their state, so a
 * section toggled by hand relabels it the same way the original does: "Collapse
 * all" while anything in the group is open.
 */
export default function CollapseAllButton({ group }: { group: string }) {
  const [anyOpen, setAnyOpen] = useState(true);

  useEffect(() => {
    const refresh = () => setAnyOpen(blocksIn(group).some((b) => !b.classList.contains("collapsed")));
    refresh();
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ group: string }>).detail.group === group) refresh();
    };
    window.addEventListener(SECTION_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(SECTION_CHANGED_EVENT, onChanged);
  }, [group]);

  function onClick() {
    const detail: SetCollapsedDetail = { group, collapsed: anyOpen };
    window.dispatchEvent(new CustomEvent(SET_COLLAPSED_EVENT, { detail }));
  }

  return (
    <button type="button" className="toggle-all" onClick={onClick}>
      {anyOpen ? "Collapse all" : "Expand all"}
    </button>
  );
}
