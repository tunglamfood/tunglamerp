"use client";
import { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-white ${className}`}>{children}</div>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-mute">{sub}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone = "" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-mute">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-mute">{sub}</div>}
    </Card>
  );
}

export function Chip({ children, tone = "gray" }: { children: ReactNode; tone?: "gray" | "teal" | "amber" | "red" | "blue" }) {
  const tones: Record<string, string> = {
    gray: "bg-gray-100 text-gray-600",
    teal: "bg-accent-soft text-accent",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-600",
    blue: "bg-sky-50 text-sky-700",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Btn({
  children, onClick, kind = "primary", size = "md", type = "button", className = "", disabled,
}: {
  children: ReactNode; onClick?: () => void; kind?: "primary" | "ghost" | "danger";
  /** "sm" is for buttons sitting inside a dense table row, where 44px would
   *  stretch every row. Everything a thumb reaches for should stay "md". */
  size?: "md" | "sm";
  type?: "button" | "submit"; className?: string; disabled?: boolean;
}) {
  const kinds = {
    primary: "bg-accent text-white hover:opacity-90",
    ghost: "border border-line bg-white text-ink hover:bg-gray-50",
    danger: "border border-red-200 bg-white text-red-600 hover:bg-red-50",
  };
  // 44px is the smallest target a finger hits reliably.
  const sizes = { md: "min-h-[44px] px-3.5 py-2", sm: "px-2.5 py-1.5" };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`rounded-lg text-sm font-medium transition disabled:opacity-40 ${sizes[size]} ${kinds[kind]} ${className}`}>
      {children}
    </button>
  );
}

export const inputCls =
  "rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-gray-400 focus:border-accent focus:ring-2 focus:ring-accent/15";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-mute">{label}</span>
      {children}
    </label>
  );
}

export function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-ink/40 p-3 sm:p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mt-4 w-full max-w-lg rounded-xl bg-white p-4 shadow-xl sm:mt-10 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-mute hover:bg-gray-100">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
