// Shown for any screen inside the app that has no placeholder of its own.
// A title, a couple of controls and a list covers the shape of most of them.
import { Loading, HeadSkeleton, TableSkeleton } from "@/components/skeleton";

export default function Loading_() {
  return (
    <Loading>
      <HeadSkeleton />
      <TableSkeleton rows={8} cols={5} />
    </Loading>
  );
}
