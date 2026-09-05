import { deleteRun, setRunArchived } from "@/lib/db";

export const dynamic = "force-dynamic";

function parseId(raw: string): number | null {
  const id = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(id) || id <= 0) return null;
  return id;
}

/** Both mutations were reachable by anyone with the URL, keyed by a sequential
 *  integer, and DELETE was a hard delete on a table with no backup.
 *
 *  Two gates, because they stop different things. The origin check stops a
 *  cross-site request made on a reader's behalf and costs no configuration.
 *  The token check stops someone who simply has the link, and turns itself on
 *  the moment ADMIN_TOKEN is set — absent, the dashboard keeps working exactly
 *  as it does today rather than locking her out of her own site. */
function refuse(request: Request): Response | null {
  const expected = process.env.ADMIN_TOKEN;
  if (expected) {
    const offered = request.headers.get("x-admin-token");
    if (offered !== expected) return new Response("Forbidden", { status: 403 });
    return null;
  }

  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("host");
    let sameOrigin = false;
    try {
      sameOrigin = new URL(origin).host === host;
    } catch {
      sameOrigin = false;
    }
    if (!sameOrigin) return new Response("Forbidden", { status: 403 });
  }
  return null;
}

/** Archive or unarchive a run. Body: { archived: boolean } */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = refuse(request);
  if (denied) return denied;

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

/** Remove a run from every view. Recoverable — see deleteRun. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = refuse(request);
  if (denied) return denied;

  const { id: raw } = await params;
  const id = parseId(raw);
  if (id === null) return new Response("Invalid run id", { status: 400 });

  await deleteRun(id);
  return Response.json({ ok: true });
}
