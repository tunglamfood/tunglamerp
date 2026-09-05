import { Notice } from "@/components/ui";
import { listAssignments } from "@/lib/store-hr";
import { listWorkers } from "@/lib/store";
import { AssignmentsScreen } from "@/components/assignments-screen";
import { Assignment, Worker } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  let assignments: Assignment[] = [];
  let workers: Worker[] = [];
  let problem: string | null = null;
  try {
    [assignments, workers] = await Promise.all([listAssignments(), listWorkers()]);
  } catch (e) {
    problem = (e as Error).message;
  }

  if (problem) {
    return (
      <Notice tone="bad">
        Could not reach the system&rsquo;s storage. {problem}
      </Notice>
    );
  }

  return <AssignmentsScreen assignments={assignments} workers={workers} />;
}
