"use client";
import { ReactNode, useEffect, useRef, useState } from "react";
import { Dropdown, Option } from "./dropdown";

export type { Option } from "./dropdown";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-white ${className}`}>{children}</div>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-mute">{sub}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone = "" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-faint">{label}</div>
      <div className={`nums mt-1.5 text-2xl font-extrabold tracking-tight ${tone}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-mute">{sub}</div>}
    </Card>
  );
}

export function Chip({ children, tone = "gray" }: { children: ReactNode; tone?: "gray" | "teal" | "amber" | "red" | "blue" }) {
  const tones: Record<string, string> = {
    gray: "bg-gray-100 text-mute",
    teal: "bg-good-soft text-good",
    amber: "bg-warn-soft text-warn",
    red: "bg-bad-soft text-bad",
    blue: "bg-accent-soft text-accent",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Btn({
  children, onClick, kind = "primary", size = "md", type = "button", className = "", disabled, title,
}: {
  children: ReactNode; onClick?: () => void; kind?: "primary" | "ghost" | "danger";
  size?: "md" | "sm"; type?: "button" | "submit"; className?: string; disabled?: boolean; title?: string;
}) {
  const kinds = {
    primary: "bg-accent text-white hover:bg-accent-hover shadow-sm",
    ghost: "border border-line bg-white text-ink hover:bg-gray-50",
    danger: "border border-bad/30 bg-white text-bad hover:bg-bad-soft",
  };
  const sizes = { md: "min-h-[42px] px-4 py-2", sm: "px-2.5 py-1.5" };
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title}
      className={`rounded-xl text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${sizes[size]} ${kinds[kind]} ${className}`}>
      {children}
    </button>
  );
}

export const inputCls =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm placeholder:text-faint transition focus:border-accent";

/**
 * Kept as a thin name over Dropdown so call sites read the same. The list is
 * drawn by us, not the operating system — see components/dropdown.tsx.
 */
export function Select({
  value, options, onChange, className = "", disabled, placeholder, searchable,
}: {
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  searchable?: boolean;
}) {
  return (
    <Dropdown value={value} options={options} onChange={onChange} className={className}
      disabled={disabled} placeholder={placeholder} searchable={searchable} />
  );
}

/**
 * Pick one of the values already in use, or type a new one.
 *
 * The factory's own words — sites, groups, nationalities, statuses — are not
 * ours to fix in a list. Whatever has been used before is offered; anything
 * else can be typed, and from then on it is offered too.
 */
export function Combobox({
  value, options, onChange, placeholder, addLabel = "Add a new one…", disabled,
}: {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  placeholder?: string;
  addLabel?: string;
  disabled?: boolean;
}) {
  const known = options.includes(value) && value !== "";
  const [typing, setTyping] = useState(!known && value !== "");

  if (typing) {
    return (
      <div className="flex gap-2">
        <input autoFocus className={inputCls} value={value} placeholder={placeholder}
          disabled={disabled} onChange={(e) => onChange(e.target.value)} />
        {options.length > 0 && (
          <button type="button" disabled={disabled}
            onClick={() => { setTyping(false); onChange(options[0]); }}
            className="shrink-0 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-mute transition hover:bg-gray-50">
            Pick one
          </button>
        )}
      </div>
    );
  }

  return (
    <Dropdown
      value={value}
      disabled={disabled}
      placeholder="Choose one…"
      options={[
        ...options.map((o) => ({ value: o, label: o })),
        { value: "__new__", label: addLabel },
      ]}
      onChange={(v) => {
        if (v === "__new__") {
          setTyping(true);
          onChange("");
        } else {
          onChange(v);
        }
      }}
    />
  );
}

/**
 * A panel that slides in from the right over a list that stays exactly where
 * it was. Escape closes it, as does the scrim behind.
 */
export function Drawer({
  open, title, sub, onClose, children, footer,
}: {
  open: boolean;
  title: string;
  sub?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // The page keeps its scroll position; scrollbar-gutter holds the width so
    // nothing behind the drawer shifts a pixel.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="no-print fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="scrim absolute inset-0 bg-shell/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="drawer absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-start gap-3 border-b border-line px-6 py-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
            {sub && <p className="mt-0.5 text-sm text-mute">{sub}</p>}
          </div>
          <button onClick={onClose} aria-label="Close"
            className="-mr-1 rounded-lg p-1.5 text-mute transition hover:bg-gray-100 hover:text-ink">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" className="h-5 w-5">
              <path d="M5 5l10 10M15 5 5 15" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="flex items-center gap-2 border-t border-line bg-gray-50/70 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-faint">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-mute">{hint}</span>}
    </label>
  );
}

/* ── The step cards that carry the monthly routine ─────────────────────────── */

export type StepState = "done" | "current" | "waiting";

export function Step({
  n, title, state, hint, children, delay = 0,
}: {
  n: number; title: string; state: StepState; hint?: ReactNode; children?: ReactNode; delay?: number;
}) {
  const ring = {
    done: "bg-good text-white",
    current: "bg-accent text-white",
    waiting: "bg-gray-200 text-faint",
  }[state];
  const card = {
    done: "border-line bg-white",
    current: "border-accent-line bg-white ring-1 ring-accent-line",
    waiting: "border-line bg-white/60",
  }[state];

  return (
    <section
      className={`rise rounded-2xl border p-5 ${card}`}
      style={{ animationDelay: `${delay}ms` }}
      aria-current={state === "current" ? "step" : undefined}
    >
      <div className="flex items-start gap-3">
        <div className={`nums mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${ring}`}>
          {state === "done" ? (
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="M4 10.5 8 14.5l8-9" />
            </svg>
          ) : (
            n
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className={`text-base font-bold tracking-tight ${state === "waiting" ? "text-faint" : ""}`}>
            {title}
          </h2>
          {hint && <div className="mt-1 text-sm text-mute">{hint}</div>}
          {children && <div className="mt-4">{children}</div>}
        </div>
      </div>
    </section>
  );
}

/* ── A file picker you can actually see ────────────────────────────────────── */

export function FilePicker({
  label, hint, required, accept = ".xls,.xlsx", file, onPick, disabled, template,
}: {
  label: string; hint?: string; required?: boolean; accept?: string;
  file: File | null; onPick: (f: File | null) => void; disabled?: boolean;
  /** Optional "download a blank one" link, for files the office has to make. */
  template?: { href: string; label: string };
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const border = file
    ? "border-good bg-good-soft"
    : over
      ? "border-accent bg-accent-soft"
      : "border-line bg-white hover:border-accent-line hover:bg-accent-soft/40";

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-faint">{label}</span>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${required ? "text-bad" : "text-faint"}`}>
          {required ? "needed" : "optional"}
        </span>
        {template && (
          <a href={template.href} download
            className="ml-auto text-[11px] font-semibold text-accent underline underline-offset-2 hover:text-accent-hover">
            {template.label}
          </a>
        )}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (disabled) return;
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) onPick(dropped);
        }}
        className={`rounded-2xl border-2 border-dashed p-5 transition ${border} ${disabled ? "opacity-50" : ""}`}
      >
        {/* The browser prints its own "No file chosen" beside a file input and
            gives no way to restyle it, so the real input is taken out of the
            layout completely and driven by the button below. */}
        <input ref={ref} type="file" accept={accept} disabled={disabled} tabIndex={-1}
          aria-hidden="true"
          style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
          onChange={(e) => onPick(e.target.files?.[0] ?? null)} />

        {file ? (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-good text-white">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M4 10.5 8 14.5l8-9" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{file.name}</div>
              <div className="nums text-xs text-mute">{(file.size / 1024).toFixed(0)} KB · ready</div>
            </div>
            <Btn kind="ghost" size="sm" disabled={disabled}
              onClick={() => { onPick(null); if (ref.current) ref.current.value = ""; }}>
              Remove
            </Btn>
          </div>
        ) : (
          <button type="button" disabled={disabled} onClick={() => ref.current?.click()}
            className="flex w-full items-center gap-3 text-left disabled:cursor-not-allowed">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M10 14V4m0 0L6.5 7.5M10 4l3.5 3.5M3.5 13v2.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V13" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">Choose a file, or drag one here</div>
              {hint && <div className="text-xs text-mute">{hint}</div>}
            </div>
            <span className="shrink-0 rounded-xl border border-line bg-white px-3 py-1.5 text-sm font-semibold">
              Browse
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

export function Notice({ tone, children }: { tone: "warn" | "bad" | "good" | "info"; children: ReactNode }) {
  const tones = {
    warn: "border-warn-line bg-warn-soft text-warn",
    bad: "border-bad/25 bg-bad-soft text-bad",
    good: "border-good/25 bg-good-soft text-good",
    info: "border-accent-line bg-accent-soft text-accent",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${tones[tone]}`}>{children}</div>
  );
}
