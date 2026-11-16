// Phone numbers as the dealer portal stores them: international, digits only,
// with a leading +. Dealers type "012-345 6789", "+60 12 345 6789" or
// "60123456789"; all of those are the same login.
//
// Same rule as tunglamfood.my's src/lib/portal/phone.ts — keep them in step.

/** "+60123456789", or null when it cannot be a phone number. */
export function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `60${digits.slice(1)}`; // local Malaysian number
  digits = digits.replace(/\D/g, "");
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return `+${digits}`;
}

/** "+60 12-345 6789" for showing a stored number to a person. */
export function showPhone(e164: string): string {
  const m = /^\+60(1\d)(\d{3,4})(\d{4})$/.exec(e164);
  if (m) return `+60 ${m[1]}-${m[2]} ${m[3]}`;
  const sg = /^\+65(\d{4})(\d{4})$/.exec(e164);
  if (sg) return `+65 ${sg[1]} ${sg[2]}`;
  return e164;
}
