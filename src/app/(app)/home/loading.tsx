// The dashboard reads eight tables at once, so it is the screen most likely to
// be caught mid-fetch. The placeholder keeps its exact shape — two labelled
// rows of figures, then the things needing attention — so nothing jumps when
// the real numbers land.
import { Loading, Bar, HeadSkeleton, StatsSkeleton, CardSkeleton } from "@/components/skeleton";

function GroupLabel() {
  return (
    <div className="mb-3">
      <Bar w="128px" h={10} />
    </div>
  );
}

export default function Loading_() {
  return (
    <Loading>
      <HeadSkeleton wide />

      <GroupLabel />
      <div className="mb-8">
        <StatsSkeleton />
      </div>

      <GroupLabel />
      <div className="mb-10">
        <StatsSkeleton />
      </div>

      <GroupLabel />
      <div className="grid gap-3 sm:grid-cols-2">
        <CardSkeleton lines={2} />
        <CardSkeleton lines={2} />
        <CardSkeleton lines={2} />
      </div>
    </Loading>
  );
}
