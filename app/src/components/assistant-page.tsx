"use client";
import { useCallback, useState } from "react";
import { Card, Chip } from "@/components/ui";
import { AssistantChat, Turn } from "@/components/assistant-chat";

interface SessionRow {
  id: number;
  title: string;
  model: string;
  updatedAt: string;
  messageCount?: number;
  changeCount?: number;
}

/** "Today", "Yesterday", then the date — how somebody actually reads a list. */
function when(iso: string, today: string): string {
  const day = iso.slice(0, 10);
  if (day === today) {
    return new Date(iso).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(`${today}T00:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === yesterday.toISOString().slice(0, 10)) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short" });
}

export function AssistantPage({
  initialSessions,
  today,
}: {
  initialSessions: SessionRow[];
  today: string;
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);

  const current = sessions.find((s) => s.id === sessionId);

  async function rename(title: string) {
    if (!sessionId) return;
    // Shown straight away; the list is put right from the server afterwards.
    setSessions((all) => all.map((s) => (s.id === sessionId ? { ...s, title } : s)));
    await fetch("/api/assistant/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sessionId, title }),
    });
    void refreshList();
  }

  const refreshList = useCallback(async () => {
    try {
      const res = await fetch("/api/assistant/sessions");
      const body = await res.json();
      if (res.ok) setSessions(body.value?.sessions ?? []);
    } catch {
      // The list is a convenience; a failure here must not break the chat.
    }
  }, []);

  async function open(id: number) {
    setLoading(true);
    setSessionId(id);
    try {
      const res = await fetch(`/api/assistant/sessions?id=${id}`);
      const body = await res.json();
      if (res.ok) {
        setTurns(
          (body.value?.messages ?? []).map(
            (m: { role: "user" | "assistant"; content: string; changed: string[] }) => ({
              role: m.role,
              content: m.content,
              changed: m.changed,
            }),
          ),
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: number) {
    await fetch(`/api/assistant/sessions?id=${id}`, { method: "DELETE" });
    if (id === sessionId) {
      setSessionId(null);
      setTurns([]);
    }
    void refreshList();
  }

  function startNew() {
    setSessionId(null);
    setTurns([]);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 shrink-0">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
          Assistant
        </div>
        <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight">Ask the system</h1>
        <p className="mt-1 text-sm text-mute">
          It reads the factory&rsquo;s own records to answer, and can add records for you. It
          cannot delete anything or run the payroll export. Every conversation is kept.
        </p>
      </div>

      {/* The page itself never scrolls. Only these two do. */}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* ── past conversations ──────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-col lg:order-1">
          <button
            onClick={startNew}
            className="mb-3 shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover"
          >
            New conversation
          </button>

          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-line px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
              Past conversations
              {sessions.length > 0 && <span className="nums ml-1.5">{sessions.length}</span>}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {sessions.length === 0 && (
                <p className="px-4 py-6 text-sm text-mute">
                  Nothing yet. Ask something and it will be kept here.
                </p>
              )}
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`group flex items-start gap-2 border-b border-line px-3 py-2.5 last:border-0 ${
                    s.id === sessionId ? "bg-accent-soft" : "hover:bg-gray-50"
                  }`}
                >
                  <button onClick={() => void open(s.id)} className="min-w-0 flex-1 text-left">
                    <div
                      className={`truncate text-[13px] font-semibold ${
                        s.id === sessionId ? "text-accent" : ""
                      }`}
                    >
                      {s.title}
                    </div>
                    <div className="nums mt-0.5 flex items-center gap-2 text-[11px] text-faint">
                      <span>{when(s.updatedAt, today)}</span>
                      {!!s.messageCount && <span>· {s.messageCount} messages</span>}
                      {!!s.changeCount && <Chip tone="teal">{s.changeCount} saved</Chip>}
                    </div>
                  </button>
                  <button
                    onClick={() => void remove(s.id)}
                    aria-label="Remove conversation"
                    className="shrink-0 rounded-lg p-1 text-faint opacity-0 transition hover:bg-gray-100 hover:text-bad group-hover:opacity-100"
                  >
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"
                      strokeLinecap="round" className="h-4 w-4">
                      <path d="M5 5l10 10M15 5 5 15" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ── the conversation ────────────────────────────────────────────── */}
        <Card className="flex min-h-0 flex-col overflow-hidden lg:order-2">
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-mute">
              Opening…
            </div>
          ) : (
            <AssistantChat
              turns={turns}
              setTurns={setTurns}
              sessionId={sessionId}
              setSessionId={setSessionId}
              title={current?.title}
              onRename={sessionId ? rename : undefined}
              onSaved={refreshList}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
