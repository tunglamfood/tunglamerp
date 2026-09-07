import { Loading, HeadSkeleton, TableSkeleton } from "@/components/skeleton";

export default function Loading_() {
  return (
    <Loading>
      <HeadSkeleton />
      <TableSkeleton rows={11} cols={4} />
    </Loading>
  );
}
