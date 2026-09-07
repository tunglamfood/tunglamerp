// HR stages 2 to 4: money lines, leave, documents, hostel and transport, notes.
//
// All five follow the same shape — rows hanging off a worker — so they share one
// small generic pair of helpers rather than six near-identical copies.
import "server-only";
import { serverSupabase } from "./supabase-server";
import { fail } from "./db-error";
import {
  Assignment, LeaveRecord, PayItem, WorkerDocument, WorkerNote,
} from "./types";

async function rowsOf<T>(
  table: string,
  what: string,
  order: string,
  map: (r: Record<string, unknown>) => T,
  filter?: { column: string; value: string },
): Promise<T[]> {
  let q = serverSupabase().from(table).select("*");
  if (filter) q = q.eq(filter.column, filter.value);
  const { data, error } = await q.order(order);
  fail(`Could not load ${what}`, error);
  return ((data ?? []) as Record<string, unknown>[]).map(map);
}

async function removeRow(table: string, what: string, id: number): Promise<void> {
  const { error } = await serverSupabase().from(table).delete().eq("id", id);
  fail(`Could not remove that ${what}`, error);
}

async function saveRow(
  table: string,
  what: string,
  row: Record<string, unknown>,
  id?: number,
): Promise<void> {
  const db = serverSupabase();
  const { error } = id
    ? await db.from(table).update(row).eq("id", id)
    : await db.from(table).insert(row);
  fail(`Could not save that ${what}`, error);
}

/* ── Money lines: allowances, advances, levy, hostel, fines ───────────────── */

export async function listPayItems(monthKey?: string): Promise<PayItem[]> {
  return rowsOf<PayItem>(
    "hr_pay_items", "the money lines", "code",
    (r) => ({
      id: r.id as number, monthKey: r.month_key as string, code: r.code as string,
      kind: r.kind as string, label: r.label as string,
      amount: Number(r.amount), note: (r.note as string) ?? null,
    }),
    monthKey ? { column: "month_key", value: monthKey } : undefined,
  );
}

export async function savePayItem(item: PayItem): Promise<void> {
  return saveRow("hr_pay_items", "money line", {
    month_key: item.monthKey, code: item.code, kind: item.kind,
    label: item.label, amount: item.amount, note: item.note,
  }, item.id);
}

export const deletePayItem = (id: number) => removeRow("hr_pay_items", "money line", id);

/* ── Leave ────────────────────────────────────────────────────────────────── */

export async function listLeave(code?: string): Promise<LeaveRecord[]> {
  return rowsOf<LeaveRecord>(
    "hr_leave", "the leave records", "from_date",
    (r) => ({
      id: r.id as number, code: r.code as string, kind: r.kind as string,
      fromDate: r.from_date as string, toDate: r.to_date as string,
      days: Number(r.days), paid: r.paid as boolean, note: (r.note as string) ?? null,
    }),
    code ? { column: "code", value: code } : undefined,
  );
}

export async function saveLeave(rec: LeaveRecord): Promise<void> {
  return saveRow("hr_leave", "leave record", {
    code: rec.code, kind: rec.kind, from_date: rec.fromDate, to_date: rec.toDate,
    days: rec.days, paid: rec.paid, note: rec.note,
  }, rec.id);
}

export const deleteLeave = (id: number) => removeRow("hr_leave", "leave record", id);

/* ── Documents and permits ────────────────────────────────────────────────── */

export async function listDocuments(code?: string): Promise<WorkerDocument[]> {
  return rowsOf<WorkerDocument>(
    "hr_documents", "the documents", "expires_on",
    (r) => ({
      id: r.id as number, code: r.code as string, kind: r.kind as string,
      number: (r.number as string) ?? null,
      issuedOn: (r.issued_on as string) ?? null,
      expiresOn: (r.expires_on as string) ?? null,
      note: (r.note as string) ?? null,
    }),
    code ? { column: "code", value: code } : undefined,
  );
}

export async function saveDocument(doc: WorkerDocument): Promise<void> {
  return saveRow("hr_documents", "document", {
    code: doc.code, kind: doc.kind, number: doc.number,
    issued_on: doc.issuedOn || null, expires_on: doc.expiresOn || null, note: doc.note,
  }, doc.id);
}

export const deleteDocument = (id: number) => removeRow("hr_documents", "document", id);

/* ── Hostel and transport ─────────────────────────────────────────────────── */

export async function listAssignments(code?: string): Promise<Assignment[]> {
  return rowsOf<Assignment>(
    "hr_assignments", "the hostel and transport records", "kind",
    (r) => ({
      id: r.id as number, code: r.code as string, kind: r.kind as string,
      value: r.value as string,
      fromDate: (r.from_date as string) ?? null,
      toDate: (r.to_date as string) ?? null,
      note: (r.note as string) ?? null,
    }),
    code ? { column: "code", value: code } : undefined,
  );
}

export async function saveAssignment(a: Assignment): Promise<void> {
  return saveRow("hr_assignments", "record", {
    code: a.code, kind: a.kind, value: a.value,
    from_date: a.fromDate || null, to_date: a.toDate || null, note: a.note,
  }, a.id);
}

export const deleteAssignment = (id: number) => removeRow("hr_assignments", "record", id);

/* ── Warnings and notes ───────────────────────────────────────────────────── */

export async function listNotes(code?: string): Promise<WorkerNote[]> {
  return rowsOf<WorkerNote>(
    "hr_notes", "the warnings and notes", "on_date",
    (r) => ({
      id: r.id as number, code: r.code as string, kind: r.kind as string,
      onDate: r.on_date as string, subject: r.subject as string,
      detail: (r.detail as string) ?? null,
    }),
    code ? { column: "code", value: code } : undefined,
  );
}

export async function saveNote(n: WorkerNote): Promise<void> {
  return saveRow("hr_notes", "note", {
    code: n.code, kind: n.kind, on_date: n.onDate, subject: n.subject, detail: n.detail,
  }, n.id);
}

export const deleteNote = (id: number) => removeRow("hr_notes", "note", id);
