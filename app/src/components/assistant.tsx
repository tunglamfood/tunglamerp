"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";

interface ModelChoice {
  id: string;
  label: string;
  hint: string;
  /** null when the account could not be checked. */
  available?: boolean | null;
}

interface Turn {
  role: "user" | "assistant";
  content: string;
  changed?: string[];
}

const OPENERS = [
  "How many workers have no scanner number yet?",
  "Which permits run out in the next three months?",
  "Is anything sold below cost to 433?",
  "What was overtime for last month?",
];

/**
 * The assistant, in a panel over the page rather than a screen of its own —
 * it is meant to be asked something while you are already looking at something
 * else, not visited.
 */
export function Assistant() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState<boolean | null>(null);
  const [models, setModels] = useState<ModelChoice[]>([]);
  const [model, setModel] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open || ready !== null) return;
    void fetch("/api/assistant")
      .then((r) => r.json())
      .then((b) => {
        setReady(!!b.ready);
        setModels(b.models ?? []);
        setModel((m) => m || b.default || (b.models?.[0]?.id ?? ""));
      })
      .catch(() => setReady(false));
  }, [open, ready]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, open, busy]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;

    const next = [...turns, { role: "user" as const, content: text }];
    setTurns(next);
    setDraft("");
    setBusy(true);
    setProblem(null);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: next.map((t) => ({ role: t.role, content: t.content })),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setProblem(body.error ?? "The assistant could not answer.");
        return;
      }
      setTurns([
        ...next,
        { role: "assistant", content: body.reply, changed: body.changed ?? [] },
      ]);
      // Anything it changed is on a screen behind this panel — refresh it.
      if ((body.changed ?? []).length > 0) router.refresh();
    } catch {
      setProblem("Could not reach the assistant. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

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
        <div className="flex items-start gap-3 border-b border-line px-6 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"
              strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M10 2.5 11.6 7l4.4 1.6L11.6 10 10 14.5 8.4 10 4 8.6 8.4 7 10 2.5Z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold tracking-tight">Assistant</h2>
            <p className="text-xs text-mute">
              Asks the system, not the internet. It can add records — never delete them.
            </p>
          </div>
          {turns.length > 0 && (
            <button onClick={() => { setTurns([]); setProblem(null); }}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-mute hover:bg-gray-100">
              Clear
            </button>
          )}
          <button onClick={() => setOpen(false)} aria-label="Close"
            className="-mr-1 rounded-lg p-1.5 text-mute transition hover:bg-gray-100 hover:text-ink">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" className="h-5 w-5">
              <path d="M5 5l10 10M15 5 5 15" />
            </svg>
          </button>
        </div>

        {models.length > 1 && ready !== false && (
          <div className="flex items-center gap-3 border-b border-line bg-gray-50/70 px-6 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
              Model
            </span>
            <Select
              className="w-[168px]"
              value={model}
              onChange={setModel}
              options={models.map((m) => ({
                value: m.id,
                label: m.label,
                note: m.available === false ? "not on this key" : undefined,
              }))}
            />
            <span className="min-w-0 flex-1 truncate text-xs text-mute">
              {models.find((m) => m.id === model)?.hint}
            </span>
          </div>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {ready === false && (
            <div className="rounded-xl border border-warn-line bg-warn-soft px-4 py-3 text-sm text-warn">
              <div className="font-bold">Not switched on yet</div>
              <p className="mt-1">
                The assistant needs an OpenAI key. Add a line{" "}
                <code className="font-mono">OPENAI_API_KEY=…</code> to{" "}
                <code className="font-mono">app/.env.local</code> and restart. Everything else
                in the system works without it.
              </p>
            </div>
          )}

          {turns.length === 0 && ready !== false && (
            <div>
              <p className="text-sm text-mute">
                Ask about anything in the system — the workers, a month&rsquo;s pay, a
                dealer&rsquo;s prices. Or tell it to record something.
              </p>
              <div className="mt-4 space-y-2">
                {OPENERS.map((q) => (
                  <button key={q} onClick={() => void ask(q)}
                    className="block w-full rounded-xl border border-line px-3.5 py-2.5 text-left text-sm transition hover:border-accent-line hover:bg-accent-soft/50">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((t, i) => (
            <div key={i} className={t.role === "user" ? "flex justify-end" : ""}>
              {t.role === "user" ? (
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm font-medium text-white">
                  {t.content}
                </div>
              ) : (
                <div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{t.content}</div>
                  {t.changed && t.changed.length > 0 && (
                    <div className="mt-3 rounded-xl border border-good/25 bg-good-soft px-3.5 py-2.5">
                      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-good">
                        Saved to the system
                      </div>
                      <ul className="mt-1.5 space-y-1 text-[13px] text-good">
                        {t.changed.map((c, x) => (
                          <li key={x}>· {c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {busy && (
            <div className="flex items-center gap-2 text-sm text-mute">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              Looking it up…
            </div>
          )}

          {problem && (
            <div className="rounded-xl border border-bad/25 bg-bad-soft px-4 py-3 text-sm text-bad">
              {problem}
            </div>
          )}

          <div ref={endRef} />
        </div>

        <div className="border-t border-line p-4">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              disabled={busy || ready === false}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void ask(draft);
                }
              }}
              placeholder={ready === false ? "Not switched on yet" : "Ask something…"}
              className="max-h-40 flex-1 resize-none rounded-xl border border-line px-3.5 py-2.5 text-sm placeholder:text-faint focus:border-accent disabled:bg-gray-50"
            />
            <button
              onClick={() => void ask(draft)}
              disabled={busy || !draft.trim() || ready === false}
              className="min-h-[42px] rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-40"
            >
              Ask
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
