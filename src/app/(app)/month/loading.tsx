// Monthly pay is the four numbered steps. The placeholder keeps the numbers
// visible and greys only what has to be fetched, so the shape of the job is
// readable before the data arrives.
import { Loading, Bar, HeadSkeleton } from "@/components/skeleton";

function Step({ n, lines }: { n: number; lines: number }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-[13px] font-bold text-faint">
          {n}
        </div>
        <Bar w="196px" h={15} />
      </div>
      <div className="mt-4 space-y-2.5 pl-10">
        {Array.from({ length: lines }, (_, i) => (
          <Bar key={i} w={["86%", "62%", "74%"][i % 3]} h={11} />
        ))}
      </div>
    </div>
  );
}

export default function Loading_() {
  return (
    <Loading>
      <HeadSkeleton wide />
      <div className="space-y-3">
        <Step n={1} lines={1} />
        <Step n={2} lines={2} />
        <Step n={3} lines={3} />
        <Step n={4} lines={1} />
      </div>
    </Loading>
  );
}
