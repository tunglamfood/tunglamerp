// Past conversations with the assistant.
import { deleteSession, listSessions, loadMessages } from "@/lib/store-assistant";
import { attempt, guard, problem } from "@/lib/route-helpers";

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

export async function DELETE(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return problem("Which conversation should be removed?");
  return attempt(() => deleteSession(id));
}
