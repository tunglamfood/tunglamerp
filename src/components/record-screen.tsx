"use client";
import { ReactNode, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn, Card, Drawer, Notice, PageHeader, Select } from "@/components/ui";
import { Option } from "@/components/dropdown";

export interface Column<T> {
  key: string;
  head: string;
  /** Right-aligned and tabular — for money and counts. */
  num?: boolean;
  width?: string;
  cell: (row: T) => ReactNode;
}

export interface Filter {
  key: string;
  width?: string;
  options: Option[];
  /** Rows are kept when this returns true. */
  match: (row: unknown, value: string) => boolean;
}

/**
 * The shape every record screen in the system shares: a search box, a row of
 * filters, a table, and a drawer that slides over it to add or edit one row.
 *
 * Written once so leave, documents, hostel, warnings, customers and products
 * all behave the same way — the office learns it on one screen and knows the
 * rest.
 */
export function RecordScreen<T>({
  title, sub, rows, columns, filters = [], searchIn, empty,
  newRow, editTitle, editSub, form, onSave, onDelete, canSave, addLabel = "Add",
  toolbarExtra,
}: {
  title: string;
  sub?: ReactNode;
  rows: T[];
  columns: Column<T>[];
  filters?: Filter[];
  /** Text pulled out of a row for the search box to look through. */
  searchIn: (row: T) => string;
  empty: string;
  newRow: () => T;
  editTitle: (row: T, isNew: boolean) => string;
  editSub?: (row: T, isNew: boolean) => string;
  form: (row: T, set: (row: T) => void) => ReactNode;
  onSave: (row: T) => Promise<{ error?: string }>;
  onDelete?: (row: T) => Promise<{ error?: string }>;
  canSave?: (row: T) => string | null;
  addLabel?: string;
  toolbarExtra?: ReactNode;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<T | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      for (const f of filters) {
        const v = picked[f.key] ?? "all";
        if (v !== "all" && !f.match(r, v)) return false;
      }
      return !q || searchIn(r).toLowerCase().includes(q);
    });
  }, [rows, search, picked, filters, searchIn]);

  const blocked = editing ? (canSave?.(editing) ?? null) : null;

  async function save() {
    if (!editing || blocked) return;
    setBusy(true);
    setProblem(null);
    const res = await onSave(editing);
    setBusy(false);
    if (res.error) {
      setProblem(res.error);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function remove() {
    if (!editing || !onDelete) return;
    setBusy(true);
    setProblem(null);
    const res = await onDelete(editing);
    setBusy(false);
    if (res.error) {
      setProblem(res.error);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title={title}
        sub={sub}
        right={
          <Btn onClick={() => { setEditing(newRow()); setIsNew(true); setProblem(null); }}>
            {addLabel}
          </Btn>
        }
      />

      {problem && !editing && <div className="mb-4"><Notice tone="bad">{problem}</Notice></div>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint">
            <circle cx="9" cy="9" r="5.5" /><path d="M13.5 13.5 17 17" />
          </svg>
          <input
            className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm placeholder:text-faint transition focus:border-accent"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {filters.map((f) => (
          <Select
            key={f.key}
            className={f.width ?? "w-[150px]"}
            value={picked[f.key] ?? "all"}
            options={f.options}
            onChange={(v) => setPicked((p) => ({ ...p, [f.key]: v }))}
          />
        ))}
        {toolbarExtra}
      </div>

      <div className="mb-3 flex items-center gap-3 text-sm">
        <span className="nums font-semibold">
          {shown.length} {shown.length === 1 ? "row" : "rows"}
        </span>
        {(search || Object.values(picked).some((v) => v && v !== "all")) && (
          <button onClick={() => { setSearch(""); setPicked({}); }}
            className="text-[13px] font-semibold text-accent underline underline-offset-2">
            Clear
          </button>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-gray-50/70 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                {columns.map((c) => (
                  <th key={c.key} className={`px-4 py-2.5 ${c.num ? "text-right" : ""} ${c.width ?? ""}`}>
                    {c.head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={i}
                  onClick={() => { setEditing(r); setIsNew(false); setProblem(null); }}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-accent-soft/40">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-2.5 ${c.num ? "nums text-right" : ""}`}>
                      {c.cell(r)}
                    </td>
                  ))}
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-10 text-center text-mute">
                    {rows.length === 0 ? empty : "Nothing matches that."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Drawer
        open={editing !== null}
        title={editing ? editTitle(editing, isNew) : ""}
        sub={editing ? editSub?.(editing, isNew) : undefined}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Btn onClick={() => void save()} disabled={busy || !!blocked} title={blocked ?? undefined}>
              {busy ? "Saving…" : "Save"}
            </Btn>
            <Btn kind="ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</Btn>
            {onDelete && !isNew && (
              <Btn kind="danger" onClick={() => void remove()} disabled={busy}>Remove</Btn>
            )}
            <span className="ml-auto text-xs text-faint">{blocked ?? "Esc to close"}</span>
          </>
        }
      >
        {problem && <div className="mb-4"><Notice tone="bad">{problem}</Notice></div>}
        {editing && <div className="space-y-5">{form(editing, setEditing)}</div>}
      </Drawer>
    </>
  );
}
