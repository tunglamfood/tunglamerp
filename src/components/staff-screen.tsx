"use client";
// Staff logins. Each person has their own username and password, and ticks for
// what they can open. A new login, or a reset, gives a one-time password that
// is shown here once — the person chooses their own at first sign-in.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Btn, Card, Chip, Drawer, Field, Notice, PageHeader, inputCls } from "@/components/ui";
import { remove } from "@/lib/api";
import { AREAS, AREA_LABEL, type Area } from "@/lib/areas";
import type { StaffLogin } from "@/lib/store-staff";

const blank = (): StaffLogin => ({ username: "", name: "", areas: [], active: true });

async function send(body: unknown): Promise<{ error?: string; tempPassword?: string }> {
  try {
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error ?? "That did not save. Please try again." };
    return { tempPassword: data?.value?.tempPassword };
  } catch {
    return { error: "Could not reach the system. Check your internet and try again." };
  }
}

function lastSeen(at: string | null | undefined) {
  if (!at) return "Never";
  return new Date(at).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function StaffScreen({ staff, meId }: { staff: StaffLogin[]; meId: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState<StaffLogin | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handover, setHandover] = useState<{ name: string; username: string; password: string } | null>(null);

  const isNew = editing ? !editing.id : false;
  const blocked = !editing ? null
    : !editing.name.trim() ? "Their name is needed"
      : !/^[a-z0-9._-]{2,40}$/.test(editing.username) ? "Pick a username"
        : editing.areas.length === 0 ? "Tick what they can open" : null;

  function open(s: StaffLogin) {
    setEditing({ ...s, areas: [...s.areas] });
    setError(null);
  }

  function toggle(a: Area) {
    if (!editing) return;
    const has = editing.areas.includes(a);
    setEditing({ ...editing, areas: has ? editing.areas.filter((x) => x !== a) : [...editing.areas, a] });
  }

  async function save() {
    if (!editing || blocked) return;
    setBusy(true);
    setError(null);
    const res = await send(editing);
    setBusy(false);
    if (res.error) return setError(res.error);
    if (res.tempPassword) setHandover({ name: editing.name, username: editing.username, password: res.tempPassword });
    setEditing(null);
    router.refresh();
  }

  async function reset() {
    if (!editing?.id) return;
    if (!window.confirm(`Give ${editing.name} a new one-time password? Their current password stops working and they are signed out everywhere.`)) return;
    setBusy(true);
    setError(null);
    const res = await send({ reset: editing.id });
    setBusy(false);
    if (res.error) return setError(res.error);
    if (res.tempPassword) setHandover({ name: editing.name, username: editing.username, password: res.tempPassword });
    setEditing(null);
    router.refresh();
  }

  async function drop() {
    if (!editing?.id) return;
    if (!window.confirm(`Remove ${editing.name}'s login for good? Switching it off keeps it for later instead.`)) return;
    setBusy(true);
    setError(null);
    const res = await remove(`/api/staff?id=${editing.id}`);
    setBusy(false);
    if (res.error) return setError(res.error);
    setEditing(null);
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="Staff logins"
        sub="Everyone signs in as themselves. Tick only what each person needs — sales staff never see wages."
        right={<Btn onClick={() => open(blank())}>Add login</Btn>}
      />

      {handover && (
        <div className="mb-5 rounded-2xl border border-accent-line bg-accent-soft p-5">
          <div className="text-sm font-bold text-accent">One-time password for {handover.name}</div>
          <p className="mt-1 text-sm text-ink/70">
            Give them these, in person or by message. It is shown only now. They choose their own password when they first sign in.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-faint">Username</div>
              <div className="nums text-lg font-bold">{handover.username}</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-faint">Password</div>
              <div className="nums select-all font-mono text-lg font-bold tracking-wide">{handover.password}</div>
            </div>
            <div className="ml-auto flex gap-2">
              <Btn kind="ghost" size="sm" onClick={() => void navigator.clipboard?.writeText(`Username: ${handover.username}\nPassword: ${handover.password}`)}>
                Copy
              </Btn>
              <Btn kind="ghost" size="sm" onClick={() => setHandover(null)}>Done</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Desktop table */}
      <Card className="hidden overflow-hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-gray-50/70 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Username</th>
              <th className="px-4 py-2.5">Can open</th>
              <th className="px-4 py-2.5">Last sign-in</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} onClick={() => open(s)} className="cursor-pointer border-b border-line last:border-0 hover:bg-accent-soft/40">
                <td className="px-4 py-3 font-semibold">
                  {s.name}
                  {s.id === meId && <span className="ml-2 text-xs font-medium text-faint">(you)</span>}
                </td>
                <td className="nums px-4 py-3 text-mute">{s.username}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {s.areas.map((a) => <Chip key={a} tone={a === "admin" ? "amber" : "blue"}>{AREA_LABEL[a]}</Chip>)}
                  </div>
                </td>
                <td className="nums px-4 py-3 text-mute">{lastSeen(s.lastLoginAt)}</td>
                <td className="px-4 py-3"><Status s={s} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Phone list */}
      <div className="space-y-2.5 md:hidden">
        {staff.map((s) => (
          <button key={s.id} type="button" onClick={() => open(s)} className="block w-full text-left">
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{s.name}{s.id === meId && <span className="ml-1.5 text-xs font-medium text-faint">(you)</span>}</div>
                  <div className="nums text-xs text-mute">{s.username} · {lastSeen(s.lastLoginAt)}</div>
                </div>
                <Status s={s} />
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1">
                {s.areas.map((a) => <Chip key={a} tone={a === "admin" ? "amber" : "blue"}>{AREA_LABEL[a]}</Chip>)}
              </div>
            </Card>
          </button>
        ))}
      </div>

      <Drawer
        open={editing !== null}
        title={editing ? (isNew ? "New staff login" : editing.name) : ""}
        sub={editing ? (isNew ? "They get a one-time password to start with" : editing.username) : undefined}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Btn onClick={() => void save()} disabled={busy || !!blocked} title={blocked ?? undefined}>
              {busy ? "Saving…" : isNew ? "Add login" : "Save"}
            </Btn>
            <Btn kind="ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</Btn>
            {!isNew && editing?.id !== meId && (
              <Btn kind="danger" onClick={() => void drop()} disabled={busy}>Remove</Btn>
            )}
            <span className="ml-auto text-xs text-faint">{blocked ?? "Esc to close"}</span>
          </>
        }
      >
        {editing && (
          <div className="space-y-5">
            {error && <Notice tone="bad">{error}</Notice>}
            <Field label="Name" hint="How they appear in the system — on orders they handle, for example.">
              <input className={inputCls} value={editing.name} maxLength={80}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="Username" hint="What they type to sign in. Lower case, no spaces — ahmad, mei.ling.">
              <input className={`${inputCls} nums`} value={editing.username} maxLength={40}
                autoCapitalize="none" autoCorrect="off" spellCheck={false}
                onChange={(e) => setEditing({ ...editing, username: e.target.value.toLowerCase().replace(/\s+/g, "") })} />
            </Field>
            <div>
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-faint">Can open</div>
              <div className="space-y-2">
                {AREAS.map((a) => {
                  const on = editing.areas.includes(a.id);
                  const locked = a.id === "admin" && editing.id === meId;
                  return (
                    <label key={a.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${on ? "border-accent-line bg-accent-soft/50" : "border-line hover:bg-gray-50"} ${locked ? "cursor-not-allowed opacity-70" : ""}`}>
                      <input type="checkbox" className="mt-0.5" checked={on} disabled={locked} onChange={() => toggle(a.id)} />
                      <span>
                        <span className="block text-sm font-semibold">{a.label}</span>
                        <span className="block text-xs text-mute">{a.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            {!isNew && (
              <Field label="Can sign in?">
                <div className="flex gap-2">
                  {[true, false].map((v) => (
                    <button key={String(v)} type="button" disabled={editing.id === meId}
                      onClick={() => setEditing({ ...editing, active: v })}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${editing.active === v ? "bg-accent text-white" : "border border-line bg-white text-mute"}`}>
                      {v ? "Yes" : "Switched off"}
                    </button>
                  ))}
                </div>
              </Field>
            )}
            {!isNew && (
              <div className="rounded-xl border border-line p-4">
                <div className="text-sm font-semibold">Forgotten password, or locked out?</div>
                <p className="mt-0.5 text-xs text-mute">Gives them a new one-time password and signs them out everywhere.</p>
                <Btn kind="ghost" size="sm" className="mt-3" onClick={() => void reset()} disabled={busy}>
                  Reset password
                </Btn>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}

function Status({ s }: { s: StaffLogin }) {
  if (!s.active) return <Chip>Switched off</Chip>;
  if (s.locked) return <Chip tone="red">Locked</Chip>;
  if (s.mustChange) return <Chip tone="amber">Not signed in yet</Chip>;
  return <Chip tone="teal">Active</Chip>;
}
