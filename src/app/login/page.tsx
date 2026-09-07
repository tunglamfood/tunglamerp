"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Btn, Field, inputCls } from "@/components/ui";

// One shared password, checked by /api/login on the server. Nothing here can
// let anyone in on its own — the answer always comes back from the server.
export default function LoginPage() {
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pass }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Could not sign in. Check your internet and try again.");
        return;
      }
      // The cookie is already stored by the time this resolves, so the router
      // will send it. refresh() re-runs the server layout that checks it.
      router.push("/home");
      router.refresh();
    } catch {
      setError("Could not reach the system. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white">
            TL
          </div>
          <h1 className="text-xl font-semibold tracking-tight">TungLam ERP</h1>
          <p className="mt-1 text-sm text-mute">Payroll &amp; workforce records</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-line bg-white p-6">
          <Field label="Password">
            {/* Password managers inject their own attributes into this box
                before React starts, which React then reports as the page
                having changed underneath it. Nothing is wrong and nothing is
                lost — the noise is silenced only for this one input, so a
                genuine mismatch anywhere else still gets reported. */}
            <input
              suppressHydrationWarning
              className={`${inputCls} w-full`}
              type="password"
              value={pass}
              placeholder="••••••••"
              autoFocus
              autoComplete="current-password"
              onChange={(e) => setPass(e.target.value)}
            />
          </Field>
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <Btn type="submit" className="w-full" disabled={busy || !pass}>
            {busy ? "Signing in…" : "Sign in"}
          </Btn>
        </form>
      </div>
    </div>
  );
}
