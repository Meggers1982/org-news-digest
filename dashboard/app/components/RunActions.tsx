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
  // alert() blocks the thread and reads as a browser failure rather than
  // something this page is telling you.
  const [error, setError] = useState<string | null>(null);

  async function toggleArchive() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !archived }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      setError(`Couldn't ${archived ? "unarchive" : "archive"} this run: ${err}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteRun() {
    // Recoverable now -- deleteRun stamps deleted_at rather than removing the
    // row -- but it still takes a run off every view, so it stays gated.
    if (!confirm("Remove this digest run from the dashboard?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      setError(`Couldn't delete this run: ${err}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="btn-row">
      <button type="button" className="export-btn" disabled={busy} onClick={toggleArchive}>
        {archived ? "Unarchive" : "Archive"}
      </button>
      <button
        type="button"
        className="export-btn export-btn-danger"
        disabled={busy}
        onClick={deleteRun}
      >
        Delete
      </button>
      {error && (
        <span className="ds-error" role="status">
          {error}
        </span>
      )}
    </div>
  );
}
