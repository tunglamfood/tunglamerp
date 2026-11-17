// Payment slips from the dealer portal: open one, mark it received or not accepted.
import { currentUser } from "@/lib/supabase-server";
import { setPaymentStatus, slipUrl, type PaymentStatus } from "@/lib/store-payments";
import { attempt, guard, problem, readBody, str, strOrNull } from "@/lib/route-helpers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const stop = await guard("sales");
  if (stop) return stop;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return problem("Which slip?");
  return attempt(() => slipUrl(id));
}

export async function POST(request: Request) {
  const stop = await guard("sales");
  if (stop) return stop;
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");
  const id = Number(b.id);
  if (!id) return problem("Which slip?");
  const status = str(b.status) as PaymentStatus;
  if (!["submitted", "checked", "rejected"].includes(status)) return problem("That is not a status a slip can have.");
  const officeNote = strOrNull(b.officeNote);
  if (officeNote && officeNote.length > 500) return problem("Keep the note under 500 characters.");
  if (status === "rejected" && !officeNote) return problem("Tell the dealer why, so they can send the right slip.");
  const me = await currentUser();
  return attempt(() => setPaymentStatus(id, status, officeNote, me?.name ?? "Office"));
}
