import { Notice } from "@/components/ui";
import { listLeave } from "@/lib/store-hr";
import { listWorkers } from "@/lib/store";
import { LeaveScreen } from "@/components/leave-screen";
import { LeaveRecord, Worker } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  let leave: LeaveRecord[] = [];
  let workers: Worker[] = [];
  let problem: string | null = null;
  try {
    [leave, workers] = await Promise.all([listLeave(), listWorkers()]);
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

  return <LeaveScreen leave={leave} workers={workers} />;
}
