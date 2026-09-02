import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DigestRun } from "@/lib/db";
import RunActions from "./RunActions";

const LABELS: Record<DigestRun["digest_type"], string> = {
  press: "Press Highlights",
  org: "Org Watch",
};

/** Server component on purpose: the markdown never changes client-side, so
 *  rendering it here keeps react-markdown out of the browser bundle. Archive/
 *  delete need client interactivity, so that lives in the small RunActions
 *  island instead of here. */
export default function DigestSection({
  run,
  showTime,
}: {
  run: DigestRun;
  showTime: boolean;
}) {
  return (
    <section className={`digest-section${run.archived_at ? " archived" : ""}`}>
      <div className="ds-header">
        <h3>
          {LABELS[run.digest_type]}
          {showTime && <span className="ds-time">{run.run_time}</span>}
          {run.archived_at && <span className="ds-archived-badge">Archived</span>}
        </h3>
        <div className="ds-actions">
          <span className="ds-meta">
            {run.item_count} items fetched &middot; {run.source_count} sources
          </span>
          <a className="ds-download" href={`/api/docx?id=${run.id}`}>
            Download .docx
          </a>
          <RunActions id={run.id} archived={Boolean(run.archived_at)} />
        </div>
      </div>
      <div className="markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.markdown}</ReactMarkdown>
      </div>
      {run.trends_raw && (
        <div className="section-block">
          <h4>Trends &amp; Continuity</h4>
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.trends_raw}</ReactMarkdown>
          </div>
        </div>
      )}
      {run.feature_pitch_raw && (
        <div className="section-block">
          <h4>Bigger Picture: Feature Pitch</h4>
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.feature_pitch_raw}</ReactMarkdown>
          </div>
        </div>
      )}
      {run.item_pitches_raw && (
        <div className="section-block">
          <h4>Story Ideas by Item</h4>
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.item_pitches_raw}</ReactMarkdown>
          </div>
        </div>
      )}
    </section>
  );
}
