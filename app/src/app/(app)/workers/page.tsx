"use client";
import { useEffect, useMemo, useState } from "react";
import { Btn, Card, Chip, PageHeader } from "@/components/ui";
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

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Worker | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/workers");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load the worker list.");
      setWorkers(body.workers);
      setProblem(null);
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(worker: Worker) {
    setBusy(true);
    try {
      const res = await fetch("/api/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(worker),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save that worker.");
      setEditing(null);
      await load();
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

  return (
    <>
      <PageHeader
        title="Workers"
        sub={
          loading
            ? "Loading…"
            : `${workers.length} on the list · ${active} working · ${workers.length - active} left or balik cuti`
        }
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
            {workers.some((w) => w.code === editing.code) ? `Edit ${editing.code}` : "New worker"}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Code (Million)">
              <input
                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                value={editing.code}
                onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                placeholder="B32"
              />
            </Field>
            <Field label="Name">
              <input
                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </Field>
            <Field label="Scanner ID">
              <input
                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                value={editing.scannerId}
                onChange={(e) => setEditing({ ...editing, scannerId: e.target.value })}
                placeholder="2028"
              />
            </Field>
            <Field label="Nationality">
              <input
                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                value={editing.nationality ?? ""}
                onChange={(e) => setEditing({ ...editing, nationality: e.target.value || null })}
              />
            </Field>
            <Field label="Site">
              <select
                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
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
                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
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
                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
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
        className="mb-3 w-full max-w-sm rounded-lg border border-line px-3 py-2 text-sm"
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
            {!loading && shown.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-mute">
                  {workers.length === 0
                    ? "No workers yet. Add one, or run the import script to bring in all 85."
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-mute">
        {label}
      </span>
      {children}
    </label>
  );
}
