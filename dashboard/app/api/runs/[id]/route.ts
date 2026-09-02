import { deleteRun, setRunArchived } from "@/lib/db";

export const dynamic = "force-dynamic";

function parseId(raw: string): number | null {
  const id = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(id) || id <= 0) return null;
  return id;
}

/** Archive or unarchive a run. Body: { archived: boolean } */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await params;
  const id = parseId(raw);
  if (id === null) return new Response("Invalid run id", { status: 400 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.archived !== "boolean") {
    return new Response("Body must be { archived: boolean }", { status: 400 });
  }

  await setRunArchived(id, body.archived);
  return Response.json({ ok: true });
}

/** Permanently delete a run. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await params;
  const id = parseId(raw);
  if (id === null) return new Response("Invalid run id", { status: 400 });

  await deleteRun(id);
  return Response.json({ ok: true });
}
