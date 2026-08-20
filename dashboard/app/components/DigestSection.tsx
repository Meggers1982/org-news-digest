import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DigestRun } from "@/lib/db";

const LABELS: Record<DigestRun["digest_type"], string> = {
  press: "Press Highlights",
  org: "Org Watch",
};

export default function DigestSection({ run }: { run: DigestRun | null }) {
  const label = run ? LABELS[run.digest_type] : "";

  return (
    <section className="digest-section">
      {run ? (
        <>
          <div className="ds-header">
            <h3>{label}</h3>
            <span className="ds-meta">
              {run.item_count} items &middot; {run.source_count} sources
            </span>
          </div>
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.markdown}</ReactMarkdown>
          </div>
        </>
      ) : (
        <p className="ds-meta">No digest has run yet for this section.</p>
      )}
    </section>
  );
}
