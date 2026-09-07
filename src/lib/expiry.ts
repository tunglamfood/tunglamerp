// How close a document is to running out.
//
// A lapsed work permit stops a worker working and can cost the company a fine,
// so this is the one part of the system that is meant to nag.
export type ExpiryLevel = "expired" | "urgent" | "soon" | "fine" | "none";

export const URGENT_DAYS = 30;
export const SOON_DAYS = 90;

export function daysUntil(dateIso: string | null, today: string): number | null {
  if (!dateIso) return null;
  const a = Date.parse(`${dateIso}T00:00:00`);
  const b = Date.parse(`${today}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((a - b) / 86_400_000);
}

export function expiryLevel(dateIso: string | null, today: string): ExpiryLevel {
  const days = daysUntil(dateIso, today);
  if (days == null) return "none";
  if (days < 0) return "expired";
  if (days <= URGENT_DAYS) return "urgent";
  if (days <= SOON_DAYS) return "soon";
  return "fine";
}

/** Plain words for the office, not a date to work out in their head. */
export function expiryWords(dateIso: string | null, today: string): string {
  const days = daysUntil(dateIso, today);
  if (days == null) return "no date recorded";
  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} overdue`;
  if (days === 0) return "expires today";
  if (days === 1) return "expires tomorrow";
  if (days <= 60) return `${days} days left`;
  const months = Math.round(days / 30);
  return `about ${months} months left`;
}
