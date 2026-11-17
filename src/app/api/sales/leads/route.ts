// Enquiries from the website: follow-up status and notes, and turning one into
// a dealer.
import { currentUser } from "@/lib/supabase-server";
import { convertLead, LEAD_STATUSES, updateLead, type LeadStatus } from "@/lib/store-leads";
import { attempt, guard, problem, readBody, str, strOrNull } from "@/lib/route-helpers";
import { normalisePhone } from "@/lib/phone";
import { tidyState } from "@/lib/states";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stop = await guard("sales");
  if (stop) return stop;
  const me = await currentUser();
  const by = me?.name ?? "Office";
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");
  const id = Number(b.id);
  if (!id) return problem("Which enquiry?");

  // Make them a dealer.
  if (b.convert && typeof b.convert === "object") {
    const c = b.convert as Record<string, unknown>;
    const existingCode = strOrNull(c.existingCode);
    const code = str(c.code).toUpperCase();
    const name = str(c.name);
    if (!existingCode) {
      if (!/^\d{4}\/\d{4}$/.test(code)) {
        return problem("Use the customer code from Million / AutoCount, like 3030/0123.");
      }
      if (!name) return problem("The customer needs a name.");
    }
    let portalPhone: string | null = null;
    if (c.portal === true) {
      portalPhone = normalisePhone(str(c.portalPhone));
      if (!portalPhone) return problem("That phone number does not look right for a portal login. Try 012-345 6789.");
    }
    return attempt(() =>
      convertLead(id, {
        existingCode,
        code,
        name,
        shortName: str(c.shortName),
        state: tidyState(str(c.state)),
        phone: strOrNull(c.phone),
        email: strOrNull(c.email),
        portalPhone,
        portalName: str(c.portalName),
      }, by),
    );
  }

  const status = str(b.status) as LeadStatus;
  if (!LEAD_STATUSES.includes(status)) return problem("That is not a status an enquiry can have.");
  const note = strOrNull(b.note);
  if (note && note.length > 2000) return problem("That note is too long.");
  return attempt(() =>
    updateLead(id, { status, note, ...(b.unlink ? { customerCode: null } : {}) }, by),
  );
}
