"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";

export interface ModelChoice {
  id: string;
  label: string;
  hint: string;
  /** null when the account could not be checked. */
  available?: boolean | null;
}

export interface Turn {
  role: "user" | "assistant";
  content: string;
  changed?: string[];
}

export const OPENERS = [
  "How many workers have no scanner number yet?",
  "Which permits run out in the next three months?",
  "Is anything sold below cost to 433?",
  "What was overtime for last month?",
];

/**
 * The conversation itself — the same on the full page and in the side panel, so
 * there is only one of it to get right.
 */
export function AssistantChat({
  turns,
  setTurns,
  sessionId,
  setSessionId,
  title,
  onRename,
  onSaved,
  compact,
}: {
  turns: Turn[];
  setTurns: (turns: Turn[]) => void;
  sessionId: number | null;
  setSessionId: (id: number | null) => void;
  /** The conversation's name, shown where the model row used to be. */
  title?: string;
  onRename?: (title: string) => void;
  /** Called after a reply lands, so a conversation list can refresh itself. */
  onSaved?: () => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const [ready, setReady] = useState<boolean | null>(null);
  const [models, setModels] = useState<ModelChoice[]>([]);
  const [model, setModel] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ready !== null) return;
    void fetch("/api/assistant")
      .then((r) => r.json())
      .then((b) => {
        setReady(!!b.ready);
        setModels(b.models ?? []);
        setModel((m) => m || b.default || (b.models?.[0]?.id ?? ""));
      })
      .catch(() => setReady(false));
  }, [ready]);

  // Scroll the message list itself, never the page. scrollIntoView was moving
  // the whole window, so arriving on this page from anywhere else dumped you at
  // the bottom of it instead of the top.
  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    box.scrollTop = box.scrollHeight;
  }, [turns, busy]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;

    const next = [...turns, { role: "user" as const, content: text }];
    setTurns(next);
    setDraft("");
    setBusy(true);
    setProblem(null);
    setUnsaved(false);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          sessionId: sessionId ?? undefined,
          messages: next.map((t) => ({ role: t.role, content: t.content })),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setProblem(body.error ?? "The assistant could not answer.");
        return;
      }
      setTurns([...next, { role: "assistant", content: body.reply, changed: body.changed ?? [] }]);
      if (body.sessionId && body.sessionId !== sessionId) setSessionId(body.sessionId);
      if (body.saved === false) setUnsaved(true);
      onSaved?.();
      // Anything it changed is on a screen behind this — refresh it.
      if ((body.changed ?? []).length > 0) router.refresh();
    } catch {
      setProblem("Could not reach the assistant. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {ready !== false && (
        <div className="flex items-center gap-3 border-b border-line bg-gray-50/70 px-5 py-2">
          {/* The conversation's own name sits here — the model is a setting, not
              a heading, so it goes to the right and stays out of the way. */}
          <div className="min-w-0 flex-1">
            {renaming ? (
              <input
                autoFocus
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={() => {
                  setRenaming(false);
                  const next = draftTitle.trim();
                  if (next && next !== title) onRename?.(next);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setRenaming(false);
                }}
                className="w-full rounded-lg border border-accent bg-white px-2 py-1 text-sm font-semibold"
              />
            ) : (
              <button
                type="button"
                disabled={!title || !onRename}
                onClick={() => {
                  setDraftTitle(title ?? "");
                  setRenaming(true);
                }}
                title={title && onRename ? "Click to rename" : undefined}
                className="group flex max-w-full items-center gap-1.5 rounded-lg px-1 py-1 text-left disabled:cursor-default"
              >
                <span className="truncate text-sm font-semibold">
                  {title || "New conversation"}
                </span>
                {title && onRename && (
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"
                    strokeLinecap="round" strokeLinejoin="round"
                    className="h-3.5 w-3.5 shrink-0 text-faint opacity-0 transition group-hover:opacity-100">
                    <path d="M13 4.5 15.5 7 7 15.5H4.5V13L13 4.5Z" />
                  </svg>
                )}
              </button>
            )}
          </div>

          {/* The slot keeps its width whether the model list has arrived or
              not — otherwise the bar is narrow for a moment on load and then
              snaps wider, which reads as the page breaking. */}
          <div className="w-[128px] shrink-0">
            {models.length > 0 ? (
              <Select
                value={model}
                onChange={setModel}
                options={models.map((m) => ({
                  value: m.id,
                  label: m.label,
                  note: m.available === false ? "not on this key" : undefined,
                }))}
              />
            ) : (
              <div
                aria-hidden
                className="h-[42px] rounded-xl border border-line bg-white"
              />
            )}
          </div>
        </div>
      )}

      <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {ready === false && (
          <div className="rounded-xl border border-warn-line bg-warn-soft px-4 py-3 text-sm text-warn">
            <div className="font-bold">Not switched on yet</div>
            <p className="mt-1">
              The assistant needs an OpenAI key. Add a line{" "}
              <code className="font-mono">OPENAI_API_KEY=…</code> to{" "}
              <code className="font-mono">app/.env.local</code> and restart. Everything else in
              the system works without it.
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
              {(compact ? OPENERS.slice(0, 2) : OPENERS).map((q) => (
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

        {unsaved && (
          <div className="rounded-xl border border-warn-line bg-warn-soft px-4 py-2.5 text-xs text-warn">
            The answer came through, but this conversation could not be saved — it will not be
            in the list afterwards.
          </div>
        )}

        {problem && (
          <div className="rounded-xl border border-bad/25 bg-bad-soft px-4 py-3 text-sm text-bad">
            {problem}
          </div>
        )}

      </div>

      <div className="border-t border-line p-4">
        <div className="flex items-end gap-2">
          <textarea
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
  );
}
