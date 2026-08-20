import { Document, HeadingLevel, Packer, Paragraph } from "docx";
import { getRunById } from "@/lib/db";
import { markdownToDocxParagraphs } from "@/lib/markdownToDocx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Built server-side so the docx library stays out of the browser bundle. */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("id") ?? "";
  const id = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(id) || id <= 0) {
    return new Response("Invalid run id", { status: 400 });
  }

  const run = await getRunById(id);
  if (!run) return new Response("Run not found", { status: 404 });

  const children = markdownToDocxParagraphs(run.markdown);

  if (run.trends_raw) {
    children.push(
      new Paragraph({ text: "Trends & Continuity", heading: HeadingLevel.HEADING_2, spacing: { before: 320, after: 100 } }),
      ...markdownToDocxParagraphs(run.trends_raw),
    );
  }
  if (run.feature_pitch_raw) {
    children.push(
      new Paragraph({ text: "Bigger Picture: Feature Pitch", heading: HeadingLevel.HEADING_2, spacing: { before: 320, after: 100 } }),
      ...markdownToDocxParagraphs(run.feature_pitch_raw),
    );
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  const filename = `${run.run_date}-${run.digest_type}-digest.docx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
