import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DigestRun } from "@/lib/db";
import CollapseAllButton from "./CollapseAllButton";
import CollapsibleSection from "./CollapsibleSection";
import RunActions from "./RunActions";

export const LABELS: Record<DigestRun["digest_type"], string> = {
  press: "Press Highlights",
  org: "Org Watch",
};

function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

/** Server component on purpose: the markdown never changes client-side, so
 *  rendering it here keeps react-markdown out of the browser bundle. Archive/
 *  delete and collapse need client interactivity, so they live in small
 *  islands instead of here.
 *
 *  Laid out like a run in senior-research-digest: the pitch first, then the
 *  story ideas and trends, then the digest itself -- the pitch is the point of
 *  the page and used to sit below every item of the day. Section ids are keyed
 *  by run.id so two runs on one page never collide. */
export default function DigestSection({
  run,
  showTime,
}: {
  run: DigestRun;
  showTime: boolean;
}) {
  const group = `run-${run.id}`;
  const sections = [
    { id: `feature-pitch-${run.id}`, chip: "Feature Pitch", title: "Bigger Picture: Feature Pitch",
      body: run.feature_pitch_raw, extraClass: "feature" },
    { id: `story-spotlight-${run.id}`, chip: "Story Spotlight", title: "Story Spotlight",
      body: run.story_spotlight_raw },
    { id: `item-pitches-${run.id}`, chip: "Story Ideas", title: "Story Ideas by Item",
      body: run.item_pitches_raw },
    { id: `trends-${run.id}`, chip: "Trends", title: "Trends & Continuity", body: run.trends_raw },
    { id: `items-${run.id}`, chip: "Digest", title: LABELS[run.digest_type], body: run.markdown },
  ].filter((s): s is typeof s & { body: string } => Boolean(s.body));

  return (
    <section className={`run-block${run.archived_at ? " archived" : ""}`} id={group}>
      <div className="run-block-head">
        <div>
          <h3>
            {LABELS[run.digest_type]}
            {showTime && <span className="ds-time">{run.run_time}</span>}
            {run.archived_at && <span className="badge ds-archived-badge">Archived</span>}
          </h3>
          <div className="run-block-meta">
            {run.item_count} items fetched &middot; {run.source_count} sources
          </div>
        </div>
        <div className="btn-row">
          <a className="export-btn" href={`/api/docx?id=${run.id}`}>
            Export .docx
          </a>
          <RunActions id={run.id} archived={Boolean(run.archived_at)} />
        </div>
      </div>
      <nav className="jump-links" aria-label={`Jump to a section of ${LABELS[run.digest_type]}`}>
        {sections.map((s) => (
          <a key={s.id} className="jump-link" href={`#${s.id}`}>
            {s.chip} &darr;
          </a>
        ))}
        <CollapseAllButton group={group} />
      </nav>
      {sections.map((s) => (
        <CollapsibleSection key={s.id} id={s.id} title={s.title} group={group} extraClass={s.extraClass}>
          <Markdown>{s.body}</Markdown>
        </CollapsibleSection>
      ))}
    </section>
  );
}
