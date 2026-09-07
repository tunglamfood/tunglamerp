// The grey shapes shown while a screen is still being fetched.
//
// They are deliberately the same size and in the same places as the real thing.
// A placeholder that matches the page it replaces makes the wait feel like the
// page arriving; a spinner in the middle of an empty screen makes the same wait
// feel like nothing is happening.
//
// Nothing here is interactive and nothing here fetches. These render instantly.
import { ReactNode } from "react";

/** One grey block. Everything else is built out of these. */
export function Bar({ w = "100%", h = 12, className = "" }: { w?: string; h?: number; className?: string }) {
  return (
    <div
      className={`shimmer rounded-md ${className}`}
      style={{ width: w, height: h }}
      aria-hidden
    />
  );
}

/** The title and subtitle every screen opens with. */
export function HeadSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <Bar w={wide ? "220px" : "170px"} h={26} />
        <div className="mt-2.5">
          <Bar w={wide ? "330px" : "260px"} h={13} />
        </div>
      </div>
      <div className="flex gap-2">
        <Bar w="104px" h={36} className="rounded-xl" />
        <Bar w="88px" h={36} className="rounded-xl" />
      </div>
    </div>
  );
}

/** The row of figures across the top of the dashboard. */
export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-2xl border border-line bg-white p-4">
          <Bar w="72px" h={10} />
          <div className="mt-3">
            <Bar w="94px" h={24} />
          </div>
          <div className="mt-2">
            <Bar w="120px" h={11} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * A list of records.
 *
 * Row widths vary a little on purpose — a column of identical bars reads as a
 * pattern, which the eye takes for a finished graphic rather than a wait.
 */
export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  const width = (row: number, col: number) => {
    if (col === 0) return "62%";
    const steps = ["78%", "54%", "88%", "44%", "70%", "60%"];
    return steps[(row * 3 + col * 5) % steps.length];
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        {Array.from({ length: cols }, (_, c) => (
          <div key={c} className="flex-1">
            <Bar w={c === 0 ? "56%" : "42%"} h={10} />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-3 border-b border-line px-4 py-3.5 last:border-0">
          {Array.from({ length: cols }, (_, c) => (
            <div key={c} className="flex-1">
              <Bar w={width(r, c)} h={12} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** The strip of tabs on the pages that have them. */
export function TabsSkeleton({ tabs = 5 }: { tabs?: number }) {
  const widths = ["78px", "142px", "66px", "134px", "128px", "96px"];
  return (
    <div className="mb-5 flex gap-2 border-b border-line pb-3">
      {Array.from({ length: tabs }, (_, i) => (
        <Bar key={i} w={widths[i % widths.length]} h={30} className="rounded-xl" />
      ))}
    </div>
  );
}

/** A plain card with a few lines in it. */
export function CardSkeleton({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  const widths = ["92%", "76%", "84%", "60%", "88%"];
  return (
    <div className={`rounded-2xl border border-line bg-white p-5 ${className}`}>
      <Bar w="46%" h={15} />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }, (_, i) => (
          <Bar key={i} w={widths[i % widths.length]} h={11} />
        ))}
      </div>
    </div>
  );
}

/**
 * Wraps a screen's placeholders.
 *
 * The whole thing is announced to screen readers as busy, once, rather than
 * every grey block announcing itself.
 */
export function Loading({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}
