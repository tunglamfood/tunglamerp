"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn, Card, Chip, Combobox, Drawer, Field, Notice, PageHeader, Select, inputCls } from "@/components/ui";
import { Worker, WorkerStatusOption } from "@/lib/types";

const BLANK: Worker = {
  code: "", scannerId: "", name: "", site: "", group: "", nationality: null, status: "active",
};

/** Whatever words are already in use for a field, in order. */
function inUse(workers: Worker[], pick: (w: Worker) => string | null): string[] {
  return [...new Set(workers.map(pick).filter((v): v is string => !!v))].sort();
}

type SortKey = "code" | "name" | "site" | "group" | "status";

export function WorkersTable({
  workers,
  statuses,
}: {
  workers: Worker[];
  statuses: WorkerStatusOption[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [site, setSite] = useState<string>("all");
  const [group, setGroup] = useState<string>("all");
  const [status, setStatus] = useState<string>("active");
  /** One dropdown covering the two rarely-used filters: scanner and nationality. */
  const [more, setMore] = useState<string>("all");
  /** Only set while inventing a status, which needs one extra answer. */
  const [newStatusPaid, setNewStatusPaid] = useState(false);
  const [sort, setSort] = useState<SortKey>("code");
  const [editing, setEditing] = useState<Worker | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const sites = useMemo(() => inUse(workers, (w) => w.site), [workers]);
  const groups = useMemo(() => inUse(workers, (w) => w.group), [workers]);
  const nationalities = useMemo(() => inUse(workers, (w) => w.nationality), [workers]);
  const statusNames = useMemo(() => statuses.map((s) => s.name), [statuses]);
  const statusMeta = useMemo(() => new Map(statuses.map((s) => [s.name, s])), [statuses]);
  const label = (name: string) => name.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  const tone = (name: string): "teal" | "gray" | "amber" =>
    statusMeta.get(name)?.countsAsWorking ? "teal" : name === "left" ? "gray" : "amber";

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
      if (more === "scanner-yes" && !w.scannerId) return false;
      if (more === "scanner-no" && w.scannerId) return false;
      if (more.startsWith("from:") && w.nationality !== more.slice(5)) return false;
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
  }, [workers, search, site, group, status, more, sort]);

  const filtered =
    site !== "all" || group !== "all" || status !== "active" || more !== "all" ||
    search.trim() !== "";

  function clearAll() {
    setSearch(""); setSite("all"); setGroup("all"); setStatus("active"); setMore("all");
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
      if (worker.status && !statusMeta.has(worker.status)) {
        await fetch("/api/statuses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: worker.status, countsAsWorking: newStatusPaid }),
        });
      }
      setEditing(null);
      setNewStatusPaid(false);
      router.refresh();
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const working = new Set(statuses.filter((s) => s.countsAsWorking).map((s) => s.name));
  const active = workers.filter((w) => working.has(w.status)).length;
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
            <Field label="Nationality" hint="Pick one already in use, or add a new one.">
              <Combobox
                value={editing.nationality ?? ""}
                options={nationalities}
                addLabel="Add a country…"
                placeholder="Bangladesh"
                onChange={(v) => setEditing({ ...editing, nationality: v || null })}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Site" hint="Add a new one if a site opens.">
                <Combobox value={editing.site} options={sites} addLabel="Add a site…"
                  placeholder="KB" onChange={(v) => setEditing({ ...editing, site: v })} />
              </Field>
              <Field label="Group" hint="Rename or add as the lines change.">
                <Combobox value={editing.group} options={groups} addLabel="Add a group…"
                  placeholder="B1" onChange={(v) => setEditing({ ...editing, group: v })} />
              </Field>
            </div>

            <Field label="Status" hint="This is the one label that decides who gets paid.">
              <Combobox value={editing.status} options={statusNames} addLabel="Add a status…"
                placeholder="probation"
                onChange={(v) => setEditing({ ...editing, status: v })} />
            </Field>

            {editing.status !== "" && !statusMeta.has(editing.status) && (
              <div className="rounded-xl border border-warn-line bg-warn-soft p-4">
                <div className="text-sm font-bold text-warn">
                  &ldquo;{editing.status}&rdquo; is a new status
                </div>
                <p className="mt-1 text-[13px] text-warn/90">
                  One thing to settle before it can be used: do these people get paid this month?
                </p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setNewStatusPaid(true)}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      newStatusPaid ? "bg-accent text-white" : "border border-line bg-white text-mute"
                    }`}>
                    Yes, pay them
                  </button>
                  <button type="button" onClick={() => setNewStatusPaid(false)}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      !newStatusPaid ? "bg-accent text-white" : "border border-line bg-white text-mute"
                    }`}>
                    No, leave them out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* One line: search, four dropdowns, the count. Filters should take a
          sliver of the screen, not a third of it. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint">
            <circle cx="9" cy="9" r="5.5" /><path d="M13.5 13.5 17 17" />
          </svg>
          <input
            className={`${inputCls} pl-9`}
            placeholder="Search name, code or scanner number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={status} onChange={setStatus} className="w-[156px]"
          options={[
            { value: "all", label: "Everyone", note: String(workers.length) },
            ...statusNames.map((x) => ({
              value: x, label: label(x), note: String(counts.status[x] ?? 0),
            })),
          ]} />

        <Select value={site} onChange={setSite} className="w-[126px]"
          options={[
            { value: "all", label: "All sites" },
            ...sites.map((x) => ({ value: x, label: x, note: String(counts.site[x] ?? 0) })),
          ]} />

        <Select value={group} onChange={setGroup} className="w-[134px]"
          options={[
            { value: "all", label: "All groups" },
            ...groups.map((x) => ({ value: x, label: x, note: String(counts.group[x] ?? 0) })),
          ]} />

        <Select value={more} onChange={setMore} className="w-[168px]"
          options={[
            { value: "all", label: "Anyone" },
            { label: "Scanner", heading: true, value: "" },
            { value: "scanner-no", label: "Not on scanner", note: String(workers.length - enrolled) },
            { value: "scanner-yes", label: "On scanner", note: String(enrolled) },
            ...(nationalities.length
              ? [{ label: "From", heading: true, value: "" } as const]
              : []),
            ...nationalities.map((n) => ({
              value: `from:${n}`, label: n, note: String(counts.nationality[n] ?? 0),
            })),
          ]} />

        <Select value={sort} onChange={(v) => setSort(v as SortKey)} className="w-[136px]"
          options={[
            { value: "code", label: "By code" },
            { value: "name", label: "By name" },
            { value: "site", label: "By site" },
            { value: "group", label: "By group" },
            { value: "status", label: "By status" },
          ]} />
      </div>

      <div className="mb-3 flex items-center gap-3 text-sm">
        <span className="nums font-semibold">
          {shown.length} {shown.length === 1 ? "worker" : "workers"}
        </span>
        {filtered && (
          <button onClick={clearAll}
            className="text-[13px] font-semibold text-accent underline underline-offset-2 hover:text-accent-hover">
            Clear filters
          </button>
        )}
      </div>

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
                  <td className="px-4 py-2.5"><Chip tone={tone(w.status)}>{label(w.status)}</Chip></td>
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
