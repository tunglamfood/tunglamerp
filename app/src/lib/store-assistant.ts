// Conversations with the assistant, kept.
import "server-only";
import { serverSupabase } from "./supabase-server";

export interface AssistantMessage {
  id?: number;
  role: "user" | "assistant";
  content: string;
  changed: string[];
  toolsUsed: string[];
  model: string;
  createdAt?: string;
}

export interface AssistantSession {
  id: number;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  /** Filled in by listSessions, so the list can show a count without a second call. */
  messageCount?: number;
  changeCount?: number;
}

function fail(what: string, error: { message: string } | null): void {
  if (error) throw new Error(`${what}: ${error.message}`);
}

/**
 * A conversation is named after the first thing asked in it. Predictable, and
 * it costs nothing — a model call to invent a title would be a second bill for
 * something a sentence already says.
 */
export function titleFrom(question: string): string {
  const clean = question.trim().replace(/\s+/g, " ");
  if (clean.length <= 60) return clean || "New conversation";
  return `${clean.slice(0, 57)}…`;
}

export async function listSessions(limit = 60): Promise<AssistantSession[]> {
  const db = serverSupabase();
  const { data, error } = await db
    .from("assistant_sessions")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
  fail("Could not load the past conversations", error);

  const sessions = (data ?? []) as Record<string, unknown>[];
  if (sessions.length === 0) return [];

  // One extra query for the counts, rather than one per conversation.
  const { data: counts, error: countError } = await db
    .from("assistant_messages")
    .select("session_id, changed")
    .in("session_id", sessions.map((s) => s.id as number));
  fail("Could not count the conversations", countError);

  const messageCount = new Map<number, number>();
  const changeCount = new Map<number, number>();
  for (const row of (counts ?? []) as { session_id: number; changed: string[] }[]) {
    messageCount.set(row.session_id, (messageCount.get(row.session_id) ?? 0) + 1);
    changeCount.set(
      row.session_id,
      (changeCount.get(row.session_id) ?? 0) + (row.changed?.length ?? 0),
    );
  }

  return sessions.map((s) => ({
    id: s.id as number,
    title: s.title as string,
    model: (s.model as string) ?? "",
    createdAt: s.created_at as string,
    updatedAt: s.updated_at as string,
    messageCount: messageCount.get(s.id as number) ?? 0,
    changeCount: changeCount.get(s.id as number) ?? 0,
  }));
}

export async function loadMessages(sessionId: number): Promise<AssistantMessage[]> {
  const { data, error } = await serverSupabase()
    .from("assistant_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at");
  fail("Could not load that conversation", error);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as number,
    role: r.role as "user" | "assistant",
    content: r.content as string,
    changed: (r.changed as string[]) ?? [],
    toolsUsed: (r.tools_used as string[]) ?? [],
    model: (r.model as string) ?? "",
    createdAt: r.created_at as string,
  }));
}

export async function createSession(title: string, model: string): Promise<number> {
  const { data, error } = await serverSupabase()
    .from("assistant_sessions")
    .insert({ title, model })
    .select("id")
    .single();
  fail("Could not start a conversation", error);
  return (data as { id: number }).id;
}

export async function addMessages(
  sessionId: number,
  messages: AssistantMessage[],
): Promise<void> {
  const db = serverSupabase();
  const { error } = await db.from("assistant_messages").insert(
    messages.map((m) => ({
      session_id: sessionId,
      role: m.role,
      content: m.content,
      changed: m.changed,
      tools_used: m.toolsUsed,
      model: m.model,
    })),
  );
  fail("Could not save that message", error);

  // Bumped so the list stays in the order the office last touched them.
  const { error: touch } = await db
    .from("assistant_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId);
  fail("Could not update the conversation", touch);
}

export async function deleteSession(id: number): Promise<void> {
  const { error } = await serverSupabase().from("assistant_sessions").delete().eq("id", id);
  fail("Could not remove that conversation", error);
}
