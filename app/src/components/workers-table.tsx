"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn, Card, Chip, Field, PageHeader, inputCls } from "@/components/ui";
import { Group, Site, Worker, WorkerStatus } from "@/lib/types";

const SITES: Site[] = ["KB", "KL"];
const GROUPS: Group[] = ["B1", "B2", "B3", "B4"];
const STATUS_LABEL: Record<WorkerStatus, string> = {
  active: "Working",
  left: "Left",
  "balik-cuti": "Balik cuti",
};
const STATUS_TONE: Record<WorkerStatus, "teal" | "gray" | "amber"> = {
  active: "teal",
  left: "gray",
  "balik-cuti": "amber",
};

const BLANK: Worker = {
  code: "",
  scannerId: "",
  name: "",
  site: "KB",
  group: "B1",
  nationality: null,
  status: "active",
};

export function WorkersTable({ workers }: { workers: Worker[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Worker | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function save(worker: Worker) {
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch("/api/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(worker),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save that worker.");
      setEditing(null);
      router.refresh();
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter(
      (w) =>
        w.code.toLowerCase().includes(q) ||
        w.name.toLowerCase().includes(q) ||
        w.scannerId.includes(q),
    );
  }, [workers, search]);

  const active = workers.filter((w) => w.status === "active").length;
  const known = new Set(workers.map((w) => w.code));

  return (
    <>
      <PageHeader
        title="Workers"
        sub={`${workers.length} on the list · ${active} working · ${workers.length - active} left or balik cuti`}
        right={
          <Btn onClick={() => setEditing({ ...BLANK })} disabled={busy}>
            Add worker
          </Btn>
        }
      />

      {problem && (
        <Card className="mb-4 border-red-200 bg-red-50 p-4 text-sm text-red-700">{problem}</Card>
      )}

      {editing && (
        <Card className="mb-4 p-4">
          <div className="mb-3 text-sm font-semibold">
            {known.has(editing.code) ? `Edit ${editing.code}` : "New worker"}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Code (Million)">
              <input
                className={inputCls}
                value={editing.code}
                onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                placeholder="B32"
              />
            </Field>
            <Field label="Name">
              <input
                className={inputCls}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </Field>
            <Field label="Scanner ID">
              <input
                className={inputCls}
                value={editing.scannerId}
                onChange={(e) => setEditing({ ...editing, scannerId: e.target.value })}
                placeholder="2028"
              />
            </Field>
            <Field label="Nationality">
              <input
                className={inputCls}
                value={editing.nationality ?? ""}
                onChange={(e) => setEditing({ ...editing, nationality: e.target.value || null })}
              />
            </Field>
            <Field label="Site">
              <select
                className={inputCls}
                value={editing.site}
                onChange={(e) => setEditing({ ...editing, site: e.target.value as Site })}
              >
                {SITES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Group">
              <select
                className={inputCls}
                value={editing.group}
                onChange={(e) => setEditing({ ...editing, group: e.target.value as Group })}
              >
                {GROUPS.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                className={inputCls}
                value={editing.status}
                onChange={(e) => setEditing({ ...editing, status: e.target.value as WorkerStatus })}
              >
                {(Object.keys(STATUS_LABEL) as WorkerStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-4 flex gap-2">
            <Btn onClick={() => void save(editing)} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Btn>
            <Btn kind="ghost" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </Btn>
          </div>
        </Card>
      )}

      <input
        className={`${inputCls} mb-3 max-w-sm`}
        placeholder="Search by code, name or scanner ID"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-mute">
              <th className="px-4 py-2.5">Code</th>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Site</th>
              <th className="px-4 py-2.5">Group</th>
              <th className="px-4 py-2.5">Scanner ID</th>
              <th className="px-4 py-2.5">Nationality</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((w) => (
              <tr key={w.code} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 font-medium tabular-nums">{w.code}</td>
                <td className="px-4 py-2.5">{w.name}</td>
                <td className="px-4 py-2.5 text-mute">{w.site}</td>
                <td className="px-4 py-2.5 text-mute">{w.group}</td>
                <td className="px-4 py-2.5 tabular-nums text-mute">
                  {w.scannerId || <span className="text-amber-600">not enrolled</span>}
                </td>
                <td className="px-4 py-2.5 text-mute">{w.nationality ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <Chip tone={STATUS_TONE[w.status]}>{STATUS_LABEL[w.status]}</Chip>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Btn kind="ghost" size="sm" onClick={() => setEditing({ ...w })}>
                    Edit
                  </Btn>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-mute">
                  {workers.length === 0
                    ? "No workers yet. Add one, or run scripts/import-workers.mjs to bring in all 85."
                    : "Nobody matches that search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}
