// The assistant fills the screen: past conversations down the left, the
// conversation itself on the right, the box you type in pinned to the bottom.
// The placeholder holds that exact frame so nothing shifts when it arrives —
// this screen used to jump on load, and a placeholder of the wrong shape would
// bring the jump back.
import { Loading, Bar } from "@/components/skeleton";

export default function Loading_() {
  return (
    <Loading>
      <div className="flex h-full min-h-0 flex-col">
        {/* title and the model bar */}
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <Bar w="188px" h={24} />
          <Bar w="132px" h={34} className="rounded-xl" />
        </div>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_1fr]">
          {/* past conversations */}
          <div className="hidden min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-white lg:flex">
            <div className="border-b border-line px-4 py-3">
              <Bar w="126px" h={11} />
            </div>
            <div className="flex-1 space-y-3 p-4">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i}>
                  <Bar w={["82%", "66%", "90%", "74%"][i % 4]} h={12} />
                  <div className="mt-1.5">
                    <Bar w="42%" h={9} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* the conversation, then the box you type in */}
          <div className="flex min-h-0 flex-col gap-3">
            <div className="min-h-0 flex-1 space-y-5 overflow-hidden rounded-2xl border border-line bg-white p-5">
              {/* asked */}
              <div className="flex justify-end">
                <div className="w-[46%] space-y-2 rounded-2xl bg-accent-soft p-3.5">
                  <Bar w="88%" h={11} />
                  <Bar w="54%" h={11} />
                </div>
              </div>
              {/* answered */}
              <div className="w-[78%] space-y-2.5">
                <Bar w="94%" h={11} />
                <Bar w="86%" h={11} />
                <Bar w="72%" h={11} />
                <Bar w="90%" h={11} />
                <Bar w="48%" h={11} />
              </div>
              <div className="flex justify-end">
                <div className="w-[34%] space-y-2 rounded-2xl bg-accent-soft p-3.5">
                  <Bar w="76%" h={11} />
                </div>
              </div>
              <div className="w-[66%] space-y-2.5">
                <Bar w="92%" h={11} />
                <Bar w="80%" h={11} />
                <Bar w="58%" h={11} />
              </div>
            </div>
            <Bar w="100%" h={52} className="rounded-2xl" />
          </div>
        </div>
      </div>
    </Loading>
  );
}
