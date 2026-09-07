"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AssistantChat, Turn } from "@/components/assistant-chat";

/**
 * The assistant as a panel over whatever you are already looking at — a
 * shortcut, not a second assistant. It writes to the same saved conversations
 * as the Assistant page, and links there for the ones that came before.
 */
export function Assistant() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Ask the assistant"
        className="no-print fixed bottom-5 right-5 z-40 flex h-14 items-center gap-2.5 rounded-full bg-accent px-5 text-sm font-bold text-white shadow-lg transition hover:bg-accent-hover"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"
          strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M10 2.5 11.6 7l4.4 1.6L11.6 10 10 14.5 8.4 10 4 8.6 8.4 7 10 2.5ZM15.5 13l.7 1.9 1.8.6-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.6.7-1.9Z" />
        </svg>
        Ask
      </button>
    );
  }

  return (
    <div className="no-print fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-shell/30" onClick={() => setOpen(false)} />

      <div className="drawer relative flex w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"
              strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M10 2.5 11.6 7l4.4 1.6L11.6 10 10 14.5 8.4 10 4 8.6 8.4 7 10 2.5Z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold tracking-tight">Assistant</h2>
            <p className="text-xs text-mute">
              Asks the system, not the internet. Kept afterwards.
            </p>
          </div>
          {turns.length > 0 && (
            <button onClick={() => { setTurns([]); setSessionId(null); }}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-mute hover:bg-gray-100">
              New
            </button>
          )}
          <Link href="/assistant" onClick={() => setOpen(false)}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-accent hover:bg-accent-soft">
            All conversations
          </Link>
          <button onClick={() => setOpen(false)} aria-label="Close"
            className="-mr-1 rounded-lg p-1.5 text-mute transition hover:bg-gray-100 hover:text-ink">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" className="h-5 w-5">
              <path d="M5 5l10 10M15 5 5 15" />
            </svg>
          </button>
        </div>

        <AssistantChat
          turns={turns}
          setTurns={setTurns}
          sessionId={sessionId}
          setSessionId={setSessionId}
          onSaved={() => router.refresh()}
          compact
        />
      </div>
    </div>
  );
}
