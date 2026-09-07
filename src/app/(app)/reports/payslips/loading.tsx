// Payslips builds one printable slip per worker, so it is the slowest screen in
// the system. The placeholder shows slips rather than a list — waiting is easier
// when you can see the shape of what is coming.
import { Loading, Bar, HeadSkeleton } from "@/components/skeleton";

function Slip() {
  return (
    <div className="rounded-2xl border border-line bg-white p-6">
      <div className="flex items-start justify-between">
        <div>
          <Bar w="148px" h={16} />
          <div className="mt-2">
            <Bar w="92px" h={11} />
          </div>
        </div>
        <Bar w="104px" h={13} />
      </div>

      <div className="mt-5 space-y-2.5 border-t border-line pt-4">
        {["78%", "64%", "82%", "58%"].map((w, i) => (
          <div key={i} className="flex items-center justify-between gap-6">
            <Bar w={w} h={11} />
            <Bar w="72px" h={11} />
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
        <Bar w="88px" h={13} />
        <Bar w="104px" h={17} />
      </div>
    </div>
  );
}

export default function Loading_() {
  return (
    <Loading>
      <HeadSkeleton wide />
      <div className="grid gap-4 lg:grid-cols-2">
        <Slip />
        <Slip />
        <Slip />
        <Slip />
      </div>
    </Loading>
  );
}
