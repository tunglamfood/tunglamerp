"use client";

/** The browser makes very good PDFs; this just opens its print dialog. */
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover"
    >
      Print or save as PDF
    </button>
  );
}
