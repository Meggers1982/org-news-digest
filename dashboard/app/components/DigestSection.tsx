import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DigestRun } from "@/lib/db";

const LABELS: Record<DigestRun["digest_type"], string> = {
  press: "Press Highlights",
  org: "Org Watch",
};

/** Server component on purpose: the markdown never changes client-side, so
 *  rendering it here keeps react-markdown out of the browser bundle. */
export default function DigestSection({
  run,
  showTime,
}: {
  run: DigestRun;
  showTime: boolean;
}) {
  return (
    <section className="digest-section">
      <div className="ds-header">
        <h3>
          {LABELS[run.digest_type]}
          {showTime && <span className="ds-time">{run.run_time}</span>}
        </h3>
        <div className="ds-actions">
          <span className="ds-meta">
            {run.item_count} items fetched &middot; {run.source_count} sources
          </span>
          <a className="ds-download" href={`/api/docx?id=${run.id}`}>
            Download .docx
          </a>
        </div>
      </div>
      <div className="markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.markdown}</ReactMarkdown>
      </div>
    </section>
  );
}
