// Past conversations with the assistant.
import { deleteSession, listSessions, loadMessages, renameSession } from "@/lib/store-assistant";
import { attempt, guard, problem, readBody, str } from "@/lib/route-helpers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const stop = await guard();
  if (stop) return stop;

  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const n = Number(id);
    if (!n) return problem("Which conversation?");
    return attempt(async () => ({ messages: await loadMessages(n) }));
  }
  return attempt(async () => ({ sessions: await listSessions() }));
}

export async function POST(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");
  const id = Number(b.id);
  const title = str(b.title);
  if (!id) return problem("Which conversation?");
  if (!title) return problem("A conversation needs a name.");
  if (title.length > 120) return problem("That name is too long.");
  return attempt(() => renameSession(id, title));
}

export async function DELETE(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return problem("Which conversation should be removed?");
  return attempt(() => deleteSession(id));
}
