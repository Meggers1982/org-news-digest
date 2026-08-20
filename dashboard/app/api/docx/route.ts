import { Document, Packer } from "docx";
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

  const doc = new Document({
    sections: [{ children: markdownToDocxParagraphs(run.markdown) }],
  });
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
