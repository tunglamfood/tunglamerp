// Workers opens on the list, behind five tabs. Both are drawn so the tab strip
// does not appear a moment after the rest and shove the table down.
import { Loading, HeadSkeleton, TabsSkeleton, TableSkeleton } from "@/components/skeleton";

export default function Loading_() {
  return (
    <Loading>
      <HeadSkeleton wide />
      <TabsSkeleton tabs={5} />
      <TableSkeleton rows={10} cols={6} />
    </Loading>
  );
}
