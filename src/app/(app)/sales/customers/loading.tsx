import { Loading, HeadSkeleton, TableSkeleton } from "@/components/skeleton";

export default function Loading_() {
  return (
    <Loading>
      <HeadSkeleton />
      <TableSkeleton rows={12} cols={5} />
    </Loading>
  );
}
