// Production → Trace a lot: which dealers received a lot (one step forward, as the Food
// Hygiene Regulations ask), from the orders delivered that day for that product.
import Link from "next/link";
import { requireArea } from "@/lib/auth";
import { findLots } from "@/lib/store-production";
import { computePlan } from "@/lib/production-server";
import { Card, Chip, Notice, PageHeader, inputCls } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TracePage({ searchParams }: { searchParams: Promise<{ lot?: string }> }) {
  await requireArea("production");
  const { lot } = await searchParams;
  const query = lot?.trim().toUpperCase() || null;
  let lots: Awaited<ReturnType<typeof findLots>> = [];
  let problem: string | null = null;
  try {
    lots = await findLots(query);
  } catch (e) {
    problem = (e as Error).message;
  }
  const exact = query ? lots.find((l) => l.lotNo === query) ?? (lots.length === 1 ? lots[0] : null) : null;
  let trace: { description: string; sources: { orderNo: string; customer: string; qty: number }[] } | null = null;
  if (exact) {
    try {
      const { plan } = await computePlan(exact.deliveryDate, false);
      const row = plan.rows.find((r) => r.itemCode === exact.itemCode);
      // One line per dealer and order (a 3-pack line and a single line add up).
      const by = new Map<string, { orderNo: string; customer: string; qty: number }>();
      for (const s of row?.sources ?? []) {
        const k = `${s.customer}|${s.orderNo}`;
        const cur = by.get(k) ?? { orderNo: s.orderNo, customer: s.customer, qty: 0 };
        cur.qty += s.qty;
        by.set(k, cur);
      }
      trace = { description: row?.description ?? exact.itemCode, sources: [...by.values()].sort((a, b) => a.customer.localeCompare(b.customer)) };
    } catch (e) {
      problem = (e as Error).message;
    }
  }

  return (
    <>
      <PageHeader title="Trace a lot" sub="Type a lot number from a label to see who received it — for a recall, a complaint or an audit." />
      <form className="mb-5 flex max-w-xl gap-2" action="/production/trace">
        <input name="lot" defaultValue={query ?? ""} placeholder="e.g. 261118-EGG-TL120" className={`${inputCls} nums`} autoCapitalize="characters" />
        <button className="rounded-xl bg-accent px-4 text-sm font-semibold text-white">Trace</button>
      </form>
      {problem && <div className="mb-4"><Notice tone="bad">{problem}</Notice></div>}

      {exact && trace && (
        <Card className="mb-6 overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <div className="nums text-lg font-extrabold">{exact.lotNo}</div>
            <div className="text-sm text-mute">
              {trace.description} · made {exact.producedOn ?? "—"} · EXP {exact.expiryDate ?? "—"} · delivered {exact.deliveryDate}
              {exact.actualQty != null ? ` · ${exact.actualQty.toLocaleString("en-MY")} made` : ""}
            </div>
          </div>
          {trace.sources.length === 0 ? (
            <p className="px-5 py-6 text-sm text-mute">No confirmed orders for this product on that delivery day.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[10px] font-bold uppercase tracking-[0.1em] text-faint"><th className="px-5 py-2">Dealer</th><th className="px-3 py-2">Order</th><th className="px-5 py-2 text-right">Quantity</th></tr></thead>
              <tbody>
                {trace.sources.map((s, i) => (
                  <tr key={i} className="border-t border-line"><td className="px-5 py-2.5 font-medium">{s.customer}</td><td className="nums px-3 py-2.5 text-mute">{s.orderNo}</td><td className="nums px-5 py-2.5 text-right font-semibold">{s.qty.toLocaleString("en-MY")}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {query && !exact && lots.length === 0 && <Notice tone="warn">No lot matches “{query}”.</Notice>}

      {(!exact || lots.length > 1) && lots.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-3 text-sm font-bold">{query ? "Matching lots" : "Recent lots"}</div>
          <table className="w-full text-sm">
            <tbody>
              {lots.map((l) => (
                <tr key={`${l.lotNo}-${l.deliveryDate}`} className="border-t border-line first:border-0">
                  <td className="px-5 py-2.5"><Link href={`/production/trace?lot=${encodeURIComponent(l.lotNo)}`} className="nums font-semibold text-accent underline underline-offset-2">{l.lotNo}</Link></td>
                  <td className="nums px-3 py-2.5 text-mute">made {l.producedOn ?? "—"}</td>
                  <td className="px-5 py-2.5 text-right">{l.expiryDate ? <Chip>EXP {l.expiryDate}</Chip> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {!query && lots.length === 0 && !problem && (
        <Card className="px-6 py-12 text-center text-sm text-mute">No lots yet. They are recorded on the daily plan after production (made quantity → lot number and EXP date).</Card>
      )}
    </>
  );
}
