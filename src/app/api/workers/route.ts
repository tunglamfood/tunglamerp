// The worker list. Every call re-checks the cookie: proxy.ts is an optimistic
// gate, and this route touches the record that decides who gets paid.
import { requireSession } from "@/lib/supabase-server";
import { deleteWorker, listWorkers, upsertWorker } from "@/lib/store";
import { Group, Site, Worker, WorkerStatus } from "@/lib/types";

export const runtime = "nodejs";

const SITES: Site[] = ["KB", "KL"];
const GROUPS: Group[] = ["B1", "B2", "B3", "B4"];
const STATUSES: WorkerStatus[] = ["active", "left", "balik-cuti"];

function unauthorised() {
  return Response.json({ error: "Please sign in again." }, { status: 401 });
}

function problem(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

/** Returns the worker, or a sentence saying what is wrong with it. */
function readWorker(body: unknown): Worker | string {
  const b = body as Record<string, unknown>;
  const code = String(b?.code ?? "").trim().toUpperCase();
  const name = String(b?.name ?? "").trim();
  if (!code) return "Every worker needs a code — the one Million uses, like B32.";
  if (!name) return "Every worker needs a name.";
  if (!SITES.includes(b?.site as Site)) return `Site must be KB or KL, not "${b?.site}".`;
  if (!GROUPS.includes(b?.group as Group)) return `Group must be B1, B2, B3 or B4, not "${b?.group}".`;
  const status = (b?.status as WorkerStatus) ?? "active";
  if (!STATUSES.includes(status)) return `Status must be active, left or balik-cuti, not "${status}".`;

  return {
    code,
    scannerId: String(b?.scannerId ?? "").trim(),
    name,
    site: b!.site as Site,
    group: b!.group as Group,
    nationality: b?.nationality ? String(b.nationality).trim() : null,
    status,
  };
}

export async function GET() {
  if (!(await requireSession())) return unauthorised();
  try {
    return Response.json({ workers: await listWorkers() });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await requireSession())) return unauthorised();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problem("Could not read what was sent.");
  }
  const worker = readWorker(body);
  if (typeof worker === "string") return problem(worker);
  try {
    await upsertWorker(worker);
    return Response.json({ ok: true, worker });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await requireSession())) return unauthorised();
  const code = new URL(request.url).searchParams.get("code")?.trim();
  if (!code) return problem("Which worker should be removed?");
  try {
    await deleteWorker(code);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
