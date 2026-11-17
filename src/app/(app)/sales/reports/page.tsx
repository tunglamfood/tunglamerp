// Sales → Sales report: what was ordered, by whom and through which door, how many
// dealers use the portal, and which regular dealers have gone quiet.
import Link from "next/link";
import { requireArea } from "@/lib/auth";
import { listCustomers, listGroups, listOrders, listProducts } from "@/lib/store-sales";
import { listPortalAccounts, listReps, type SalesRep } from "@/lib/store-portal";
import type { SalesOrder } from "@/lib/types";
import { periodRange, salesReport, type SalesReport } from "@/lib/sales-report";
import { Card, Notice, PageHeader, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

const rm = (n: number) => `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const PERIODS = [
  { key: "month", label: "This month" },
  { key: "last", label: "Last month" },
  { key: "90", label: "Last 90 days" },
];
const todayMY = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

async function load(p: string) {
  const today = todayMY();
  const period = periodRange(p, today);
  // 120 days back as well, so "gone quiet" can see each dealer's usual rhythm.
  const back = new Date(Date.now() - 125 * 86400_000).toISOString().slice(0, 10);
  const since = period.from < back ? period.from : back;
  try {
    const [orders, customers, products, accounts, groups, reps] = await Promise.all([
      listOrders(5000, since), listCustomers(), listProducts(), listPortalAccounts(), listGroups(), listReps(),
    ]);
    const report = salesReport({
      orders, customers, products, from: period.from, to: period.to, today,
      logins: accounts.map((a) => ({ customerCode: a.customerCode, groupCode: a.groupCode, role: a.role, active: a.active, lastLoginAt: a.lastLoginAt ?? null })),
      groupNames: Object.fromEntries(groups.map((g) => [g.code, g.name])),
    });
    return { period, report, reps: repRows(reps, orders, period.from, period.to), problem: null };
  } catch (e) {
    return { period, report: null, reps: [], problem: (e as Error).message };
  }
}

export default async function SalesReportPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  await requireArea("sales");
  const { p = "month" } = await searchParams;
  const { period, report, reps, problem } = await load(p);

  return (
    <>
      <PageHeader
        title="Sales report"
        sub={`${period.label} · cancelled orders and office drafts are left out`}
        right={
          <div className="flex gap-1 rounded-xl border border-line bg-white p-1">
            {PERIODS.map((x) => (
              <Link key={x.key} href={`/sales/reports?p=${x.key}`}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${period.key === x.key ? "bg-accent text-white" : "text-mute hover:text-ink"}`}>
                {x.label}
              </Link>
            ))}
          </div>
        }
      />
      {!report ? <Notice tone="bad">Could not build the report. {problem}</Notice> : <Report r={report} />}
      {report && reps.length > 0 && <RepTable reps={reps} monthly={period.key !== "90"} />}
    </>
  );
}

function Report({ r }: { r: SalesReport }) {
  const portalPct = r.orders ? Math.round(((r.bySource.portal + r.bySource.rep) / r.orders) * 100) : 0;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Orders" value={String(r.orders)} sub={`from ${r.dealers} dealer${r.dealers === 1 ? "" : "s"}`} />
        <Stat label="Order value" value={rm(r.value)} sub={r.unpricedLines ? `+ ${r.unpricedLines} line${r.unpricedLines === 1 ? "" : "s"} with no price yet` : "before tax"} />
        <Stat label="Average order" value={rm(r.avgValue)} />
        <Stat label="Through the portal" value={`${portalPct}%`}
          sub={`${r.bySource.portal} by dealers · ${r.bySource.rep} by reps · ${r.bySource.office} by the office`} />
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-bold">Order value by {r.bucket}</h2>
          <span className="text-xs text-mute">Hover a bar for the figure</span>
        </div>
        <Bars r={r} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <h2 className="border-b border-line px-5 py-3 text-sm font-bold">Top dealers</h2>
          {r.topDealers.length === 0 ? <Empty /> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                <th className="px-5 py-2">Dealer</th><th className="px-3 py-2 text-right">Orders</th><th className="px-3 py-2 text-right">Portal</th><th className="px-5 py-2 text-right">Value</th>
              </tr></thead>
              <tbody>
                {r.topDealers.map((d) => (
                  <tr key={d.key} className="border-t border-line">
                    <td className="px-5 py-2.5 font-medium">{d.name}</td>
                    <td className="nums px-3 py-2.5 text-right">{d.orders}</td>
                    <td className="nums px-3 py-2.5 text-right text-mute">{Math.round(d.portalShare * 100)}%</td>
                    <td className="nums px-5 py-2.5 text-right font-semibold">{rm(d.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card className="overflow-hidden">
          <h2 className="border-b border-line px-5 py-3 text-sm font-bold">Top products by quantity</h2>
          {r.topProducts.length === 0 ? <Empty /> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                <th className="px-5 py-2">Product</th><th className="px-3 py-2 text-right">Quantity</th><th className="px-5 py-2 text-right">Value</th>
              </tr></thead>
              <tbody>
                {r.topProducts.map((x) => (
                  <tr key={x.itemCode} className="border-t border-line">
                    <td className="px-5 py-2.5"><div className="font-medium">{x.description}</div><div className="nums text-xs text-faint">{x.itemCode}</div></td>
                    <td className="nums px-3 py-2.5 text-right">{x.qty.toLocaleString("en-MY")} {x.uom.toLowerCase()}</td>
                    <td className="nums px-5 py-2.5 text-right font-semibold">{x.value ? rm(x.value) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {r.chains.length > 0 && (
        <Card className="overflow-hidden">
          <h2 className="border-b border-line px-5 py-3 text-sm font-bold">Chains (all branches together)</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
              <th className="px-5 py-2">Chain</th><th className="px-3 py-2 text-right">Branches ordering</th><th className="px-3 py-2 text-right">Orders</th><th className="px-5 py-2 text-right">Value</th>
            </tr></thead>
            <tbody>
              {r.chains.map((c) => (
                <tr key={c.code} className="border-t border-line">
                  <td className="px-5 py-2.5 font-medium">{c.name}</td>
                  <td className="nums px-3 py-2.5 text-right">{c.ordering} <span className="text-mute">of {c.branches}</span></td>
                  <td className="nums px-3 py-2.5 text-right">{c.orders}</td>
                  <td className="nums px-5 py-2.5 text-right font-semibold">{rm(c.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card className="p-5">
          <h2 className="text-sm font-bold">Dealer portal use</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row k="Dealers with a portal login" v={r.adoption.dealersWithLogin} />
            <Row k="Signed in during the last 30 days" v={r.adoption.signedIn30d} />
            <Row k="Ordered on the portal in this period" v={r.adoption.orderedOnPortal} />
          </dl>
          <p className="mt-4 text-xs text-mute">Add logins under Dealer portal → Logins, or turn a website enquiry into a dealer.</p>
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-3">
            <h2 className="text-sm font-bold">Gone quiet</h2>
            <p className="text-xs text-mute">Regular dealers who have not ordered for much longer than usual — worth a call.</p>
          </div>
          {r.quiet.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-mute">Nobody stands out. This needs a few weeks of orders to work.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                <th className="px-5 py-2">Dealer</th><th className="px-3 py-2 text-right">Usually every</th><th className="px-5 py-2 text-right">Last order</th>
              </tr></thead>
              <tbody>
                {r.quiet.map((q) => (
                  <tr key={q.key} className="border-t border-line">
                    <td className="px-5 py-2.5 font-medium">{q.name}</td>
                    <td className="nums px-3 py-2.5 text-right text-mute">{q.usualGap} day{q.usualGap === 1 ? "" : "s"}</td>
                    <td className="nums px-5 py-2.5 text-right"><span className="font-semibold text-bad">{q.daysSince} days ago</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}

type RepRow = { code: string; name: string; dealers: number; orders: number; value: number; target: number | null; commission: number | null };

/** Each rep's dealers' orders in the period (any source), against their monthly target. */
function repRows(reps: SalesRep[], orders: SalesOrder[], from: string, to: string): RepRow[] {
  return reps
    .filter((r) => r.active)
    .map((r) => {
      const mine = new Set(r.customerCodes);
      const os = orders.filter((o) => o.customerCode && mine.has(o.customerCode) && o.status !== "cancelled" && o.status !== "draft" && o.orderDate >= from && o.orderDate <= to);
      const worth = (list: SalesOrder[]) => Math.round(list.reduce((s, o) => s + o.lines.reduce((t, l) => t + l.qty * l.price, 0), 0) * 100) / 100;
      const value = worth(os);
      const delivered = worth(os.filter((o) => o.status === "delivered"));
      const commission = r.commissionRate ? Math.round(delivered * r.commissionRate) / 100 : null;
      return { code: r.code, name: r.name, dealers: r.customerCodes.length, orders: os.length, value, target: r.monthlyTarget, commission };
    })
    .sort((a, b) => b.value - a.value);
}

function RepTable({ reps, monthly }: { reps: RepRow[]; monthly: boolean }) {
  return (
    <Card className="mt-6 overflow-hidden">
      <div className="border-b border-line px-5 py-3">
        <h2 className="text-sm font-bold">Sales reps</h2>
        <p className="text-xs text-mute">Orders from the dealers each rep looks after, whoever placed them. Set targets under Dealer portal → Sales reps.</p>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
          <th className="px-5 py-2">Rep</th><th className="px-3 py-2 text-right">Dealers</th><th className="px-3 py-2 text-right">Orders</th>
          <th className="px-3 py-2 text-right">Value</th><th className="px-3 py-2 text-right">Commission</th>{monthly && <th className="px-5 py-2">Monthly target</th>}
        </tr></thead>
        <tbody>
          {reps.map((r) => {
            const pct = r.target ? Math.min(100, Math.round((r.value / r.target) * 100)) : null;
            return (
              <tr key={r.code} className="border-t border-line">
                <td className="px-5 py-2.5 font-medium">{r.name}</td>
                <td className="nums px-3 py-2.5 text-right text-mute">{r.dealers}</td>
                <td className="nums px-3 py-2.5 text-right">{r.orders}</td>
                <td className="nums px-3 py-2.5 text-right font-semibold">{rm(r.value)}</td>
                <td className="nums px-3 py-2.5 text-right text-mute" title="Rate × orders marked Delivered">{r.commission == null ? "—" : rm(r.commission)}</td>
                {monthly && (
                  <td className="px-5 py-2.5">
                    {pct == null ? <span className="text-faint">No target</span> : (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} /></div>
                        <span className="nums text-xs text-mute">{pct}% of {rm(r.target!)}</span>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-mute">{k}</dt>
      <dd className="nums text-lg font-extrabold tracking-tight">{v}</dd>
    </div>
  );
}

function Empty() {
  return <p className="px-5 py-8 text-center text-sm text-mute">No orders in this period yet.</p>;
}

/** One series, one colour. The figures are also in a table for screen readers. */
function Bars({ r }: { r: SalesReport }) {
  const max = Math.max(1, ...r.series.map((b) => b.value));
  const step = Math.ceil(r.series.length / 8);
  return (
    <>
      <div className="flex h-44 items-end gap-[3px]" aria-hidden>
        {r.series.map((b) => (
          <div key={b.start} className="group relative flex h-full flex-1 items-end"
            title={`${b.label}: ${rm(b.value)} · ${b.orders} order${b.orders === 1 ? "" : "s"}`}>
            <div className="w-full rounded-t-[3px] bg-accent/85 transition group-hover:bg-accent"
              style={{ height: `${b.value > 0 ? Math.max(2, (b.value / max) * 100) : 0}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-[3px] border-t border-line pt-1.5 text-[10px] text-faint" aria-hidden>
        {r.series.map((b, i) => (
          <span key={b.start} className="nums flex-1 truncate text-center">{i % step === 0 ? b.label : ""}</span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Order value by {r.bucket}</caption>
        <tbody>
          {r.series.map((b) => <tr key={b.start}><th>{b.label}</th><td>{rm(b.value)}</td><td>{b.orders} orders</td></tr>)}
        </tbody>
      </table>
    </>
  );
}
