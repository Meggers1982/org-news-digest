import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DigestRun } from "@/lib/db";
import CollapsibleSection from "./CollapsibleSection";
import RunActions from "./RunActions";

const LABELS: Record<DigestRun["digest_type"], string> = {
  press: "Press Highlights",
  org: "Org Watch",
};

/** Server component on purpose: the markdown never changes client-side, so
 *  rendering it here keeps react-markdown out of the browser bundle. Archive/
 *  delete need client interactivity, so that lives in the small RunActions
 *  island instead of here.
 *
 *  Section ids are plain JSX attributes (these headings are hand-written here,
 *  not produced by react-markdown, so no rehype-slug is needed) and are keyed
 *  by run.id so multiple runs on one page never collide. */
export default function DigestSection({
  run,
  showTime,
}: {
  run: DigestRun;
  showTime: boolean;
}) {
  const trendsId = `trends-${run.id}`;
  const featurePitchId = `feature-pitch-${run.id}`;
  const storySpotlightId = `story-spotlight-${run.id}`;
  const itemPitchesId = `item-pitches-${run.id}`;

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
      {(run.feature_pitch_raw || run.story_spotlight_raw || run.item_pitches_raw) && (
        <nav className="ds-jumplinks" aria-label="Jump to section">
          <span>Jump to:</span>
          {run.feature_pitch_raw && <a href={`#${featurePitchId}`}>Feature Pitch</a>}
          {run.story_spotlight_raw && <a href={`#${storySpotlightId}`}>Story Spotlight</a>}
          {run.item_pitches_raw && <a href={`#${itemPitchesId}`}>Story Ideas</a>}
        </nav>
      )}
      <div className="markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.markdown}</ReactMarkdown>
      </div>
      {run.trends_raw && (
        <CollapsibleSection id={trendsId} title="Trends & Continuity">
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.trends_raw}</ReactMarkdown>
          </div>
        </CollapsibleSection>
      )}
      {run.feature_pitch_raw && (
        <CollapsibleSection id={featurePitchId} title="Bigger Picture: Feature Pitch">
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.feature_pitch_raw}</ReactMarkdown>
          </div>
        </CollapsibleSection>
      )}
      {run.story_spotlight_raw && (
        <CollapsibleSection id={storySpotlightId} title="Story Spotlight">
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.story_spotlight_raw}</ReactMarkdown>
          </div>
        </CollapsibleSection>
      )}
      {run.item_pitches_raw && (
        <CollapsibleSection id={itemPitchesId} title="Story Ideas by Item">
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.item_pitches_raw}</ReactMarkdown>
          </div>
        </CollapsibleSection>
      )}
    </section>
  );
}
