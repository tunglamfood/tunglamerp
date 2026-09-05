import { Notice } from "@/components/ui";
import { listDocuments } from "@/lib/store-hr";
import { listWorkers } from "@/lib/store";
import { DocumentsScreen } from "@/components/documents-screen";
import { WorkerDocument, Worker } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  let documents: WorkerDocument[] = [];
  let workers: Worker[] = [];
  let problem: string | null = null;
  try {
    [documents, workers] = await Promise.all([listDocuments(), listWorkers()]);
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

  // Worked out on the server so every warning counts from the same day.
  const today = new Date().toISOString().slice(0, 10);
  return <DocumentsScreen documents={documents} workers={workers} today={today} />;
}
