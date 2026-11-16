// Who may sign in to the dealer portal at tunglamfood.my/portal.
import { deletePortalAccount, savePortalAccount } from "@/lib/store-portal";
import { attempt, guard, problem, readBody, str, strOrNull } from "@/lib/route-helpers";
import { normalisePhone } from "@/lib/phone";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");

  const phone = normalisePhone(str(b.phone));
  if (!phone) return problem("That does not look like a phone number. Try 012-345 6789.");
  const role = str(b.role) === "rep" ? "rep" : "dealer";
  const customerCode = strOrNull(b.customerCode);
  const groupCode = strOrNull(b.groupCode);
  const repCode = strOrNull(b.repCode);
  if (role === "dealer" && !customerCode && !groupCode) return problem("Which dealer (or group) is this login for?");
  if (role === "rep" && !repCode) return problem("Which sales rep is this login for?");

  return attempt(() =>
    savePortalAccount({
      id: b.id ? Number(b.id) : undefined,
      phone,
      name: str(b.name),
      role,
      customerCode,
      groupCode,
      repCode,
      active: b.active !== false,
    }),
  );
}

export async function DELETE(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return problem("Which login should be removed?");
  return attempt(() => deletePortalAccount(id));
}
