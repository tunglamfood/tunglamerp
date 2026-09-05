import { Notice } from "@/components/ui";
import { listNotes } from "@/lib/store-hr";
import { listWorkers } from "@/lib/store";
import { NotesScreen } from "@/components/notes-screen";
import { Worker, WorkerNote } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  let notes: WorkerNote[] = [];
  let workers: Worker[] = [];
  let problem: string | null = null;
  try {
    [notes, workers] = await Promise.all([listNotes(), listWorkers()]);
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

  return <NotesScreen notes={notes} workers={workers} />;
}
