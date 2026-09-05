import { Notice } from "@/components/ui";
import { listExits } from "@/lib/store-hr";
import { listWorkers } from "@/lib/store";
import { ExitsScreen } from "@/components/exits-screen";
import { ExitRecord, Worker } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  let exits: ExitRecord[] = [];
  let workers: Worker[] = [];
  let problem: string | null = null;
  try {
    [exits, workers] = await Promise.all([listExits(), listWorkers()]);
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

  const today = new Date().toISOString().slice(0, 10);
  return <ExitsScreen exits={exits} workers={workers} today={today} />;
}
