"use client";
import { useEffect, useId, useRef, useState } from "react";

export interface Option {
  value: string;
  label: string;
  /** Small greyed text on the right — a count, a hint. */
  note?: string;
  /** Renders as a non-selectable heading. */
  heading?: boolean;
}

/**
 * A dropdown whose open list we actually control.
 *
 * A native <select> hands its list to the operating system, which ignores every
 * style rule — so the closed box looked like the rest of the system and the
 * open list did not. This draws the list itself: same type, same corners, same
 * teal, and it can carry counts and a search box, which a native list cannot.
 */
export function Dropdown({
  value,
  options,
  onChange,
  placeholder = "Choose…",
  className = "",
  disabled,
  searchable,
  align = "left",
}: {
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Adds a filter box. Turns itself on past a dozen options. */
  searchable?: boolean;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selectable = options.filter((o) => !o.heading);
  const withSearch = searchable ?? selectable.length > 12;
  const shown = query
    ? options.filter((o) => !o.heading && o.label.toLowerCase().includes(query.toLowerCase()))
    : options;
  const current = selectable.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  function onTriggerKey(e: React.KeyboardEvent) {
    if (["ArrowDown", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
      setActive(Math.max(0, shown.findIndex((o) => o.value === value)));
    }
  }

  function onListKey(e: React.KeyboardEvent) {
    const pickable = shown.filter((o) => !o.heading);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, pickable.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = pickable[active];
      if (pick) choose(pick.value);
    }
  }

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKey}
        className={`flex w-full items-center gap-2 rounded-xl border bg-white px-3 py-2.5 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? "border-accent ring-1 ring-accent-line" : "border-line hover:border-accent-line"
        }`}
      >
        <span className={`flex-1 truncate ${current ? "" : "font-normal text-faint"}`}>
          {current?.label ?? placeholder}
        </span>
        {current?.note && <span className="nums shrink-0 text-xs text-faint">{current.note}</span>}
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round"
          className={`h-4 w-4 shrink-0 text-faint transition ${open ? "rotate-180" : ""}`}>
          <path d="m6 8 4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute z-50 mt-1.5 min-w-full overflow-hidden rounded-xl border border-line bg-white shadow-xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
          onKeyDown={onListKey}
        >
          {withSearch && (
            <div className="border-b border-line p-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                placeholder="Type to narrow the list…"
                className="w-full rounded-lg border border-line px-2.5 py-1.5 text-sm placeholder:text-faint"
              />
            </div>
          )}

          <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto py-1">
            {shown.length === 0 && (
              <li className="px-3 py-3 text-sm text-mute">Nothing matches that.</li>
            )}
            {shown.map((o, i) => {
              if (o.heading) {
                return (
                  <li key={`h-${o.label}-${i}`}
                    className="px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                    {o.label}
                  </li>
                );
              }
              const idx = shown.filter((x) => !x.heading).indexOf(o);
              const selected = o.value === value;
              return (
                <li key={o.value} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => choose(o.value)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                      selected
                        ? "bg-accent text-white"
                        : idx === active
                          ? "bg-accent-soft text-accent"
                          : "text-ink hover:bg-accent-soft"
                    }`}
                  >
                    <span className="flex-1 truncate font-medium">{o.label}</span>
                    {o.note && (
                      <span className={`nums shrink-0 text-xs ${selected ? "text-white/70" : "text-faint"}`}>
                        {o.note}
                      </span>
                    )}
                    {selected && (
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4"
                        strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0">
                        <path d="M4 10.5 8 14.5l8-9" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
