// Everything about the people: the list itself, and the records kept against
// them. One page with tabs rather than five sidebar entries, so it is obvious
// where a worker's things live.
import { listStatuses, listWorkers } from "@/lib/store";
import { listAssignments, listDocuments, listLeave, listNotes } from "@/lib/store-hr";
import { listHolidays } from "@/lib/store-holidays";
import type { Holiday } from "@/lib/store-holidays";
import { WorkerHub } from "@/components/worker-hub";
import { Notice } from "@/components/ui";
import {
  Assignment, LeaveRecord, Worker, WorkerDocument, WorkerNote, WorkerStatusOption,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function WorkersPage() {
  let workers: Worker[] = [];
  let statuses: WorkerStatusOption[] = [];
  let documents: WorkerDocument[] = [];
  let leave: LeaveRecord[] = [];
  let assignments: Assignment[] = [];
  let notes: WorkerNote[] = [];
  let holidays: Holiday[] = [];
  let problem: string | null = null;

  try {
    [workers, statuses, documents, leave, assignments, notes, holidays] = await Promise.all([
      listWorkers(), listStatuses(), listDocuments(), listLeave(), listAssignments(),
      listNotes(), listHolidays(),
    ]);
  } catch (e) {
    // Most likely the database tables have not been created yet. Say so in
    // words rather than crashing the page.
    problem = (e as Error).message;
  }

  if (problem) {
    return (
      <Notice tone="bad">
        Could not reach the worker list. {problem}
        <div className="mt-2 font-normal">
          If this is the first run, the tables may not exist yet — run supabase/schema.sql.
        </div>
      </Notice>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  return (
    <WorkerHub
      workers={workers} statuses={statuses} documents={documents}
      leave={leave} assignments={assignments} notes={notes} holidays={holidays} today={today}
    />
  );
}
