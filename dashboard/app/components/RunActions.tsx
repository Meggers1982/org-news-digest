"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Archive/unarchive and delete controls for one run. A small client island
 *  next to DigestSection's server-rendered markdown — kept separate so
 *  react-markdown itself stays out of the browser bundle. */
export default function RunActions({
  id,
  archived,
}: {
  id: number;
  archived: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggleArchive() {
    setBusy(true);
    try {
      const res = await fetch(`/api/runs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !archived }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      alert(`Couldn't ${archived ? "unarchive" : "archive"} this run: ${err}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteRun() {
    if (!confirm("Permanently delete this digest run? This can't be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/runs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      alert(`Couldn't delete this run: ${err}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ds-run-actions">
      <button type="button" className="ds-btn" disabled={busy} onClick={toggleArchive}>
        {archived ? "Unarchive" : "Archive"}
      </button>
      <button
        type="button"
        className="ds-btn ds-btn-danger"
        disabled={busy}
        onClick={deleteRun}
      >
        Delete
      </button>
    </div>
  );
}
