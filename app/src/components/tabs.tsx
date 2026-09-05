"use client";
import { ReactNode, useState } from "react";

export interface Tab {
  id: string;
  label: string;
  /** A count or a warning shown beside the label. */
  note?: string;
  tone?: "plain" | "warn";
  panel: ReactNode;
}

/**
 * One page, several views of the same subject.
 *
 * Everything about a worker belongs on the worker page; everything about a
 * month belongs on the month page. Splitting them into separate items in the
 * sidebar made the system look bigger than it is and hid where things live.
 */
export function Tabs({ tabs, initial }: { tabs: Tab[]; initial?: string }) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-1 border-b border-line">
        {tabs.map((t) => {
          const on = t.id === current?.id;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              aria-current={on ? "page" : undefined}
              className={`-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition ${
                on
                  ? "border-accent text-accent"
                  : "border-transparent text-mute hover:border-line hover:text-ink"
              }`}
            >
              {t.label}
              {t.note && (
                <span
                  className={`nums rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                    t.tone === "warn"
                      ? "bg-warn-soft text-warn"
                      : on
                        ? "bg-accent-soft text-accent"
                        : "bg-gray-100 text-faint"
                  }`}
                >
                  {t.note}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {current?.panel}
    </>
  );
}
