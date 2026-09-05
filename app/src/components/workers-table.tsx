"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn, Card, Chip, Drawer, Field, Notice, PageHeader, Select, inputCls } from "@/components/ui";
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
  code: "", scannerId: "", name: "", site: "KB", group: "B1", nationality: null, status: "active",
};

type SortKey = "code" | "name" | "site" | "group" | "status";

/** One filter row: a label and a set of buttons, including an "All". */
function FilterRow<T extends string>({
  label, options, value, onChange, counts,
}: {
  label: string;
  options: readonly T[];
  value: T | "all";
  onChange: (v: T | "all") => void;
  counts?: Record<string, number>;
  }) {
  const pill = (active: boolean) =>
    `rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition ${
      active ? "bg-accent text-white" : "bg-white text-mute hover:bg-accent-soft hover:text-accent"
    }`;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-[72px] shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
        {label}
      </span>
      <button className={pill(value === "all")} onClick={() => onChange("all")}>
        All
      </button>
      {options.map((o) => (
        <button key={o} className={pill(value === o)} onClick={() => onChange(o)}>
          {o}
          {counts?.[o] != null && (
            <span className="nums ml-1.5 opacity-60">{counts[o]}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function WorkersTable({ workers }: { workers: Worker[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [site, setSite] = useState<Site | "all">("all");
  const [group, setGroup] = useState<Group | "all">("all");
  const [status, setStatus] = useState<WorkerStatus | "all">("active");
  const [nationality, setNationality] = useState<string | "all">("all");
  const [enrolment, setEnrolment] = useState<"all" | "yes" | "no">("all");
  const [sort, setSort] = useState<SortKey>("code");
  const [editing, setEditing] = useState<Worker | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const nationalities = useMemo(
    () => [...new Set(workers.map((w) => w.nationality).filter(Boolean))].sort() as string[],
    [workers],
  );

  const counts = useMemo(() => {
    const by = (pick: (w: Worker) => string | null) => {
      const c: Record<string, number> = {};
      for (const w of workers) {
        const k = pick(w);
        if (k) c[k] = (c[k] ?? 0) + 1;
      }
      return c;
    };
    return {
      site: by((w) => w.site),
      group: by((w) => w.group),
      status: by((w) => w.status),
      nationality: by((w) => w.nationality),
    };
  }, [workers]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = workers.filter((w) => {
      if (site !== "all" && w.site !== site) return false;
      if (group !== "all" && w.group !== group) return false;
      if (status !== "all" && w.status !== status) return false;
      if (nationality !== "all" && w.nationality !== nationality) return false;
      if (enrolment === "yes" && !w.scannerId) return false;
      if (enrolment === "no" && w.scannerId) return false;
      if (!q) return true;
      return (
        w.code.toLowerCase().includes(q) ||
        w.name.toLowerCase().includes(q) ||
        w.scannerId.includes(q) ||
        (w.nationality ?? "").toLowerCase().includes(q)
      );
    });
    return out.sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name)
        : sort === "site" ? a.site.localeCompare(b.site) || a.code.localeCompare(b.code)
        : sort === "group" ? a.group.localeCompare(b.group) || a.code.localeCompare(b.code)
        : sort === "status" ? a.status.localeCompare(b.status) || a.code.localeCompare(b.code)
        : a.code.localeCompare(b.code),
    );
  }, [workers, search, site, group, status, nationality, enrolment, sort]);

  const filtered =
    site !== "all" || group !== "all" || status !== "active" || nationality !== "all" ||
    enrolment !== "all" || search.trim() !== "";

  function clearAll() {
    setSearch(""); setSite("all"); setGroup("all"); setStatus("active");
    setNationality("all"); setEnrolment("all");
  }

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

  const active = workers.filter((w) => w.status === "active").length;
  const enrolled = workers.filter((w) => w.scannerId).length;
  const known = new Set(workers.map((w) => w.code));

  return (
    <>
      <PageHeader
        title="Workers"
        sub={
          <span className="nums">
            {workers.length} on the list · {active} working · {enrolled} linked to the scanner
          </span>
        }
        right={<Btn onClick={() => setEditing({ ...BLANK })} disabled={busy}>Add worker</Btn>}
      />

      {problem && <div className="mb-4"><Notice tone="bad">{problem}</Notice></div>}

      {/* The list behind stays exactly where it was; the editor slides over it. */}
      <Drawer
        open={editing !== null}
        title={editing && known.has(editing.code) ? `Edit ${editing.code}` : "New worker"}
        sub={editing && known.has(editing.code) ? editing.name : "Add somebody to the payroll"}
        onClose={() => setEditing(null)}
        footer={
          editing ? (
            <>
              <Btn onClick={() => void save(editing)} disabled={busy}>
                {busy ? "Saving…" : "Save worker"}
              </Btn>
              <Btn kind="ghost" onClick={() => setEditing(null)} disabled={busy}>
                Cancel
              </Btn>
              <span className="ml-auto text-xs text-faint">Esc to close</span>
            </>
          ) : null
        }
      >
        {editing && (
          <div className="space-y-5">
            <Field label="Code (Million)" hint="The one Million uses, like B32">
              <input className={inputCls} value={editing.code} placeholder="B32"
                onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Name">
              <input className={inputCls} value={editing.name} placeholder="Full name as on the payroll"
                onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="Scanner ID" hint="Their number on the CheckTime machine. Leave blank if not enrolled yet.">
              <input className={inputCls} value={editing.scannerId} placeholder="2028"
                onChange={(e) => setEditing({ ...editing, scannerId: e.target.value })} />
            </Field>
            <Field label="Nationality">
              <input className={inputCls} value={editing.nationality ?? ""} placeholder="Bangladesh"
                onChange={(e) => setEditing({ ...editing, nationality: e.target.value || null })} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Site">
                <Select value={editing.site} onChange={(v) => setEditing({ ...editing, site: v as Site })}>
                  {SITES.map((x) => <option key={x} value={x}>{x}</option>)}
                </Select>
              </Field>
              <Field label="Group">
                <Select value={editing.group} onChange={(v) => setEditing({ ...editing, group: v as Group })}>
                  {GROUPS.map((x) => <option key={x} value={x}>{x}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Status" hint="Mark somebody as left or balik cuti and they drop out of the monthly calculation.">
              <Select value={editing.status} onChange={(v) => setEditing({ ...editing, status: v as WorkerStatus })}>
                {(Object.keys(STATUS_LABEL) as WorkerStatus[]).map((x) => (
                  <option key={x} value={x}>{STATUS_LABEL[x]}</option>
                ))}
              </Select>
            </Field>
          </div>
        )}
      </Drawer>

      {/* ── search and filters ──────────────────────────────────────────── */}
      <Card className="mb-4 p-4">
        <div className="relative mb-4">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint">
            <circle cx="9" cy="9" r="5.5" /><path d="M13.5 13.5 17 17" />
          </svg>
          <input
            className={`${inputCls} pl-9`}
            placeholder="Search a name, a code, a scanner number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="space-y-2.5">
          <FilterRow label="Site" options={SITES} value={site} onChange={setSite} counts={counts.site} />
          <FilterRow label="Group" options={GROUPS} value={group} onChange={setGroup} counts={counts.group} />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 w-[72px] shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
              Status
            </span>
            {(["all", "active", "left", "balik-cuti"] as const).map((s) => (
              <button key={s} onClick={() => setStatus(s as WorkerStatus | "all")}
                className={`rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition ${
                  status === s ? "bg-accent text-white" : "bg-white text-mute hover:bg-accent-soft hover:text-accent"
                }`}>
                {s === "all" ? "All" : STATUS_LABEL[s as WorkerStatus]}
                {s !== "all" && counts.status[s] != null && (
                  <span className="nums ml-1.5 opacity-60">{counts.status[s]}</span>
                )}
              </button>
            ))}
          </div>
          {nationalities.length > 1 && (
            <FilterRow label="From" options={nationalities} value={nationality}
              onChange={setNationality} counts={counts.nationality} />
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 w-[72px] shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
              Scanner
            </span>
            {([["all", "All"], ["yes", "Linked"], ["no", "Not enrolled"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setEnrolment(v)}
                className={`rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition ${
                  enrolment === v ? "bg-accent text-white" : "bg-white text-mute hover:bg-accent-soft hover:text-accent"
                }`}>
                {l}
                {v === "yes" && <span className="nums ml-1.5 opacity-60">{enrolled}</span>}
                {v === "no" && <span className="nums ml-1.5 opacity-60">{workers.length - enrolled}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3">
          <span className="nums text-sm font-semibold">
            {shown.length} {shown.length === 1 ? "worker" : "workers"} shown
          </span>
          <div className="ml-auto flex items-center gap-2 text-xs text-mute">
            Sort by
            <Select value={sort} onChange={(v) => setSort(v as SortKey)} className="w-32">
              <option value="code">Code</option>
              <option value="name">Name</option>
              <option value="site">Site</option>
              <option value="group">Group</option>
              <option value="status">Status</option>
            </Select>
          </div>
          {filtered && (
            <Btn kind="ghost" size="sm" onClick={clearAll}>Clear filters</Btn>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-gray-50/70 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                <th className="px-4 py-2.5">Code</th>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Site</th>
                <th className="px-4 py-2.5">Group</th>
                <th className="px-4 py-2.5">Scanner ID</th>
                <th className="px-4 py-2.5">From</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((w) => (
                <tr key={w.code} onClick={() => setEditing({ ...w })}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-accent-soft/40">
                  <td className="nums px-4 py-2.5 font-semibold">{w.code}</td>
                  <td className="px-4 py-2.5">{w.name}</td>
                  <td className="px-4 py-2.5 text-mute">{w.site}</td>
                  <td className="px-4 py-2.5 text-mute">{w.group}</td>
                  <td className="nums px-4 py-2.5 text-mute">
                    {w.scannerId || <span className="text-warn">not enrolled</span>}
                  </td>
                  <td className="px-4 py-2.5 text-mute">{w.nationality ?? "—"}</td>
                  <td className="px-4 py-2.5"><Chip tone={STATUS_TONE[w.status]}>{STATUS_LABEL[w.status]}</Chip></td>
                  <td className="px-4 py-2.5 text-right">
                    <Btn kind="ghost" size="sm" onClick={() => setEditing({ ...w })}>Edit</Btn>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-mute">
                    {workers.length === 0
                      ? "No workers yet. Add one, or run scripts/import-workers.mjs to bring in all 85."
                      : "Nobody matches that. Try clearing the filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
