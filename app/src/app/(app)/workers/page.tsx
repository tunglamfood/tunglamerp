// The worker list is fetched on the server, so the page arrives with the data
// already in it rather than blank-then-populated.
import { listStatuses, listWorkers } from "@/lib/store";
import { WorkersTable } from "@/components/workers-table";
import { Card } from "@/components/ui";
import { Worker, WorkerStatusOption } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function WorkersPage() {
  let workers: Worker[] = [];
  let statuses: WorkerStatusOption[] = [];
  let problem: string | null = null;
  try {
    [workers, statuses] = await Promise.all([listWorkers(), listStatuses()]);
  } catch (e) {
    // Most likely the database tables have not been created yet. Say so in
    // words rather than crashing the page.
    problem = (e as Error).message;
  }

  if (problem) {
    return (
      <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <div className="font-medium">Could not reach the worker list.</div>
        <div className="mt-1">{problem}</div>
        <div className="mt-2 text-red-600">
          If this is the first run, the database tables may not exist yet — run
          supabase/schema.sql in Supabase.
        </div>
      </Card>
    );
  }

  return <WorkersTable workers={workers} statuses={statuses} />;
}
