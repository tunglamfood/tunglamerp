// Sales reps and the dealers each one may order for on the portal.
import { deleteRep, saveRep } from "@/lib/store-portal";
import { attempt, guard, problem, readBody, str } from "@/lib/route-helpers";
import { normalisePhone } from "@/lib/phone";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stop = await guard("sales");
  if (stop) return stop;
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");

  const code = str(b.code).toUpperCase();
  const name = str(b.name);
  if (!code) return problem("Every rep needs a short code, like ALI or REP01.");
  if (!name) return problem("Every rep needs a name.");
  const rawPhone = str(b.phone);
  const phone = rawPhone ? normalisePhone(rawPhone) : null;
  if (rawPhone && !phone) return problem("That does not look like a phone number.");

  return attempt(() =>
    saveRep({
      code,
      name,
      phone,
      active: b.active !== false,
      customerCodes: Array.isArray(b.customerCodes) ? (b.customerCodes as unknown[]).map(String) : [],
      monthlyTarget: Number(b.monthlyTarget) > 0 ? Math.round(Number(b.monthlyTarget) * 100) / 100 : null,
      commissionRate: Number(b.commissionRate) > 0 ? Math.min(50, Math.round(Number(b.commissionRate) * 100) / 100) : null,
    }),
  );
}

export async function DELETE(request: Request) {
  const stop = await guard("sales");
  if (stop) return stop;
  const code = str(new URL(request.url).searchParams.get("code"));
  if (!code) return problem("Which rep should be removed?");
  return attempt(() => deleteRep(code));
}
