"use client";

import { useCallback, useEffect, useState } from "react";

/* Matches agingwire-research-intelligence. 400 kept it hidden through the
   whole first screen on a tall display, so it read as missing. */
const SHOW_AFTER_PX = 240;

export default function ScrollTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toTop = useCallback(() => window.scrollTo({ top: 0, behavior: "smooth" }), []);

  return (
    <button
      type="button"
      id="scroll-top-btn"
      className={visible ? "visible" : ""}
      onClick={toTop}
      title="Back to top"
      aria-label="Back to top"
    >
      &#8593;
    </button>
  );
}
