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
    <section className="rounded-xl border border-black/10 dark:border-white/15 bg-white/60 dark:bg-white/5 p-6">
      {run ? (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
            <h2 className="text-lg font-semibold">{label}</h2>
            <span className="text-xs text-black/50 dark:text-white/50">
              {run.run_date} &middot; {run.item_count} items &middot; {run.source_count} sources
            </span>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.markdown}</ReactMarkdown>
          </div>
        </>
      ) : (
        <p className="text-sm text-black/50 dark:text-white/50">
          No digest has run yet for this section.
        </p>
      )}
    </section>
  );
}
