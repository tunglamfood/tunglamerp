// Warnings and notes kept against a worker.
import { deleteNote, listNotes, saveNote } from "@/lib/store-hr";
import { attempt, guard, problem, readBody, str, strOrNull } from "@/lib/route-helpers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const code = new URL(request.url).searchParams.get("code") ?? "";
  return attempt(async () => ({ notes: await listNotes(code || undefined) }));
}

export async function POST(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");
  const code = str(b.code);
  const subject = str(b.subject);
  const onDate = str(b.onDate);
  if (!code) return problem("Which worker is this about?");
  if (!onDate) return problem("What date did this happen?");
  if (!subject) {
    return problem("A one-line summary is needed, so the record still means something later.");
  }
  return attempt(() =>
    saveNote({
      id: b.id ? Number(b.id) : undefined,
      code,
      kind: str(b.kind, "Warning"),
      onDate,
      subject,
      detail: strOrNull(b.detail),
    }),
  );
}

export async function DELETE(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return problem("Which record should be removed?");
  return attempt(() => deleteNote(id));
}
