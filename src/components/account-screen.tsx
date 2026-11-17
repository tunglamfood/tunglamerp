"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Btn, Card, Chip, Field, Notice, PageHeader, inputCls } from "@/components/ui";

export function AccountScreen({
  name, username, areas, mustChange,
}: { name: string; username: string; areas: string[]; mustChange: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mismatch = again.length > 0 && next !== again;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (mismatch) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "That did not save. Please try again.");
        return;
      }
      setCurrent("");
      setNext("");
      setAgain("");
      setDone(true);
      if (mustChange) {
        router.push("/home");
      }
      router.refresh();
    } catch {
      setError("Could not reach the system. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="My account" sub="Your own login. Nobody else should use it." />

      {mustChange && (
        <div className="mb-5">
          <Notice tone="warn">
            You signed in with a one-time password. Choose your own password to carry on.
          </Notice>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-base font-bold text-accent">
              {name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-bold tracking-tight">{name}</div>
              <div className="nums text-sm text-mute">{username}</div>
            </div>
          </div>
          <div className="mt-5 text-[11px] font-bold uppercase tracking-[0.1em] text-faint">You can open</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {areas.map((a) => <Chip key={a} tone="blue">{a}</Chip>)}
          </div>
          <p className="mt-4 text-xs text-mute">
            To change what you can open, ask whoever manages staff logins.
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-bold tracking-tight">{mustChange ? "Choose your password" : "Change password"}</h2>
          <p className="mt-1 text-sm text-mute">
            At least 8 characters. Changing it signs you out on your other devices.
          </p>
          <form onSubmit={save} className="mt-4 space-y-4">
            <Field label={mustChange ? "One-time password" : "Current password"}>
              <input className={inputCls} type="password" autoComplete="current-password" value={current}
                onChange={(e) => setCurrent(e.target.value)} />
            </Field>
            <Field label="New password">
              <input className={inputCls} type="password" autoComplete="new-password" value={next}
                onChange={(e) => { setNext(e.target.value); setDone(false); }} />
            </Field>
            <Field label="New password again">
              <input className={inputCls} type="password" autoComplete="new-password" value={again}
                onChange={(e) => setAgain(e.target.value)} />
            </Field>
            {mismatch && <p className="text-sm font-medium text-bad">The two new passwords are not the same.</p>}
            {error && <Notice tone="bad">{error}</Notice>}
            {done && <Notice tone="good">Saved. Use your new password next time you sign in.</Notice>}
            <Btn type="submit" disabled={busy || !current || next.length < 8 || next !== again}>
              {busy ? "Saving…" : "Save new password"}
            </Btn>
          </form>
        </Card>
      </div>
    </>
  );
}
