// The debtor list, as Million knows it.
import { listCustomers, upsertCustomer } from "@/lib/store-sales";
import { attempt, guard, problem, readBody, str, strOrNull } from "@/lib/route-helpers";
import { tidyState } from "@/lib/states";

export const runtime = "nodejs";

export async function GET() {
  const stop = await guard();
  if (stop) return stop;
  return attempt(async () => ({ customers: await listCustomers() }));
}

export async function POST(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");
  const code = str(b.code);
  const name = str(b.name);
  if (!code) return problem("Every customer needs the code Million uses, like 3030/0003.");
  if (!name) return problem("Every customer needs a name.");
  return attempt(() =>
    upsertCustomer({
      code,
      name,
      shortName: str(b.shortName),
      groupCode: strOrNull(b.groupCode),
      state: tidyState(str(b.state)),
      address: strOrNull(b.address),
      contact: strOrNull(b.contact),
      email: strOrNull(b.email),
      attn: strOrNull(b.attn),
      incomeTaxNo: strOrNull(b.incomeTaxNo),
      active: b.active !== false,
    }),
  );
}
