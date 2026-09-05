"use client";

/**
 * There was no error boundary at all. The page is force-dynamic with no
 * Suspense, so a Neon hiccup fell through to Next's own error screen — which
 * cannot tell you whether the database is down or the pipeline simply hasn't
 * run yet, and offers no way back.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="boundary">
      <h2>The digest history didn&apos;t load.</h2>
      <p>
        This is the database read failing, not an empty archive — if the pipeline
        simply hadn&apos;t run today you&apos;d see the dashboard with older dates in it.
      </p>
      <p className="boundary-detail">{error.digest ?? error.message}</p>
      <button type="button" className="ds-btn" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
