"use client";
import { Tabs } from "@/components/tabs";
import { WorkersTable } from "@/components/workers-table";
import { DocumentsScreen } from "@/components/documents-screen";
import { LeaveScreen } from "@/components/leave-screen";
import { AssignmentsScreen } from "@/components/assignments-screen";
import { NotesScreen } from "@/components/notes-screen";
import { HolidaysScreen } from "@/components/holidays-screen";
import { Holiday } from "@/lib/store-holidays";
import { expiryLevel } from "@/lib/expiry";
import {
  Assignment, LeaveRecord, Worker, WorkerDocument, WorkerNote, WorkerStatusOption,
} from "@/lib/types";

export function WorkerHub({
  workers, statuses, documents, leave, assignments, notes, holidays, today,
}: {
  workers: Worker[];
  statuses: WorkerStatusOption[];
  documents: WorkerDocument[];
  leave: LeaveRecord[];
  assignments: Assignment[];
  notes: WorkerNote[];
  holidays: Holiday[];
  today: string;
}) {
  // Anything already expired or expiring within the month is worth a badge on
  // the tab itself — nobody opens a documents screen unprompted.
  const pressing = documents.filter((d) =>
    ["expired", "urgent"].includes(expiryLevel(d.expiresOn, today)),
  ).length;

  return (
    <Tabs
      tabs={[
        {
          id: "list",
          label: "The list",
          note: String(workers.length),
          panel: <WorkersTable workers={workers} statuses={statuses} />,
        },
        {
          id: "documents",
          label: "Documents & permits",
          note: pressing > 0 ? String(pressing) : String(documents.length),
          tone: pressing > 0 ? "warn" : "plain",
          panel: <DocumentsScreen documents={documents} workers={workers} today={today} />,
        },
        {
          id: "leave",
          label: "Leave",
          note: String(leave.length),
          panel: <LeaveScreen leave={leave} workers={workers} />,
        },
        {
          id: "assignments",
          label: "Hostel & transport",
          note: String(assignments.filter((a) => !a.toDate).length),
          panel: <AssignmentsScreen assignments={assignments} workers={workers} />,
        },
        {
          id: "notes",
          label: "Warnings & notes",
          note: String(notes.length),
          panel: <NotesScreen notes={notes} workers={workers} />,
        },
        {
          id: "holidays",
          label: "Public holidays",
          note: String(holidays.filter((h) => h.onDate.startsWith(today.slice(0, 4))).length),
          panel: <HolidaysScreen holidays={holidays} />,
        },
      ]}
    />
  );
}
