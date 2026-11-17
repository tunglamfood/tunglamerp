// The dashboard. What is true right now, and what needs somebody today.
import Link from "next/link";
import { Card, Stat } from "@/components/ui";
import { listStatuses, listWorkers } from "@/lib/store";
import { listAssignments, listDocuments } from "@/lib/store-hr";
import { listCustomers, listOrders, listPrices, listProducts } from "@/lib/store-sales";
import { loadMonthView } from "@/lib/month-loader";
import { alertsFor, figuresFor, Alert } from "@/lib/dashboard";
import { hasAnything } from "@/lib/month-view";
import { monthLabel } from "@/lib/time";
import { requireUser } from "@/lib/auth";
import { WEBSITE_URL, canOpen } from "@/lib/areas";
import { Notice } from "@/components/ui";

export const dynamic = "force-dynamic";

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const TONE: Record<Alert["level"], { card: string; dot: string; label: string }> = {
  bad: { card: "border-bad/25 bg-bad-soft", dot: "bg-bad", label: "text-bad" },
  warn: { card: "border-warn-line bg-warn-soft", dot: "bg-warn", label: "text-warn" },
  info: { card: "border-accent-line bg-accent-soft", dot: "bg-accent", label: "text-accent" },
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const me = await requireUser();
  const { denied } = await searchParams;
  const hr = me.areas.includes("hr");
  const sales = me.areas.includes("sales");
  const today = new Date().toISOString().slice(0, 10);
  const monthKey = today.slice(0, 7);

  // Only what this login may see is even read: a sales login never loads wages.
  const none = <T,>(): Promise<T[]> => Promise.resolve([]);
  const [workers, statuses, documents, assignments, customers, products, prices, orders] =
    await Promise.all([
      hr ? listWorkers() : none<Awaited<ReturnType<typeof listWorkers>>[number]>(),
      hr ? listStatuses() : none<Awaited<ReturnType<typeof listStatuses>>[number]>(),
      hr ? listDocuments() : none<Awaited<ReturnType<typeof listDocuments>>[number]>(),
      hr ? listAssignments() : none<Awaited<ReturnType<typeof listAssignments>>[number]>(),
      sales ? listCustomers() : none<Awaited<ReturnType<typeof listCustomers>>[number]>(),
      sales ? listProducts() : none<Awaited<ReturnType<typeof listProducts>>[number]>(),
      sales ? listPrices() : none<Awaited<ReturnType<typeof listPrices>>[number]>(),
      sales ? listOrders() : none<Awaited<ReturnType<typeof listOrders>>[number]>(),
    ]).catch(() => [[], [], [], [], [], [], [], []] as never);

  const working = new Set(statuses.filter((s) => s.countsAsWorking).map((s) => s.name));

  // The month is only worth mentioning once something has been uploaded for it.
  let monthFlags: number | null = null;
  if (hr) {
    try {
      const view = await loadMonthView(monthKey);
      monthFlags = hasAnything({ ...view, extras: {} }) ? view.flags.length : null;
    } catch {
      monthFlags = null;
    }
  }

  const figures = figuresFor({ workers, working, customers, products, orders, prices, today });
  const alerts = alertsFor({
    documents, workers, working, customers, products, prices, assignments,
    today, monthFlags, monthKey,
  }).filter((a) => canOpen(me.areas, a.href));

  return (
    <>
      {denied && (
        <div className="mb-5">
          <Notice tone="warn">Your login does not cover that page. Ask whoever manages staff logins if you need it.</Notice>
        </div>
      )}
      <div className="mb-7">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
          Tung Lam Food Industries
        </div>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
          {alerts.length === 0
            ? "Nothing needs you today."
            : alerts.length === 1
              ? "One thing needs you."
              : `${alerts.length} things need you.`}
        </h1>
        <p className="mt-1.5 text-[15px] text-mute">{monthLabel(monthKey)}</p>
      </div>

      {alerts.length > 0 && (
        <div className="mb-8 space-y-2.5">
          {alerts.map((a, i) => (
            <Link key={i} href={a.href} className="block">
              <div className={`rise rounded-2xl border p-4 transition hover:shadow-sm ${TONE[a.level].card}`}
                style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE[a.level].dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-bold ${TONE[a.level].label}`}>{a.title}</div>
                    <p className="mt-0.5 text-[13px] text-ink/70">{a.detail}</p>
                  </div>
                  <span className={`shrink-0 text-[13px] font-semibold ${TONE[a.level].label}`}>
                    {a.action} &rarr;
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!hr && !sales && (
        <Card className="mb-8 p-5">
          <div className="text-base font-bold tracking-tight">Your login is for the website</div>
          <p className="mt-1 text-[13px] text-mute">
            Products, recipes, guides and enquiries on tunglamfood.my are edited in its content admin. Sign in there with the same username and password.
          </p>
          <a href={`${WEBSITE_URL}/admin`} target="_blank" rel="noopener"
            className="mt-4 inline-flex rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover">
            Open the website admin &rarr;
          </a>
        </Card>
      )}

      {(hr || sales) && (
        <>
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
            The factory
          </h2>
          <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {hr && (
              <>
                <Stat label="Working" value={String(figures.working)}
                  sub={`of ${figures.workers} on the list`} />
                <Stat label="Not on scanner" value={String(figures.notEnrolled)}
                  sub={figures.notEnrolled === 0 ? "everyone is enrolled" : "cannot be counted yet"}
                  tone={figures.notEnrolled === 0 ? "text-good" : "text-warn"} />
              </>
            )}
            {sales && (
              <>
                <Stat label="Customers" value={String(figures.customers)} sub="still buying" />
                <Stat label="Products" value={String(figures.products)} sub="still sold" />
              </>
            )}
          </div>
        </>
      )}

      {sales && (
      <>
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
        This month&rsquo;s selling
      </h2>
      <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Orders" value={String(figures.ordersThisMonth)} sub={monthLabel(monthKey)} />
        <Stat label="Order value" value={`RM ${money(figures.orderValueThisMonth)}`}
          sub="before tax" />
        <Stat label="Products priced" value={String(figures.pricedProducts)}
          sub="have a dealer price" />
        <Stat label="Below cost" value={String(figures.belowCost)}
          sub={
            figures.belowCost === 0
              ? figures.costLooksWrong > 0
                ? `${figures.costLooksWrong} costs look mis-keyed`
                : "nothing loses money"
              : "losing money on every sale"
          }
          tone={figures.belowCost === 0 ? "text-good" : "text-bad"} />
      </div>
      </>
      )}

      {(hr || sales) && (
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
          Where everything lives
        </h2>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          {
            href: "/month",
            title: "Monthly pay",
            body: "The scanner file and the check list, and the allowances and advances that go out with it. Start here on pay day.",
          },
          {
            href: "/workers",
            title: "Workers",
            body: "Everyone on the payroll — and behind tabs on the same page, their documents and permits, leave, hostel and transport, warnings and notes.",
          },
          {
            href: "/sales/orders",
            title: "Sales orders",
            body: "Write an order and it prices itself from what that dealer pays.",
          },
          {
            href: "/sales/prices",
            title: "Price lists",
            body: "What each dealer pays for each product, and from when. Change one and old orders keep the price they were sold at.",
          },
          {
            href: "/sales/enquiries",
            title: "Enquiries",
            body: "Messages from the contact forms on tunglamfood.my. Pick them up, note what happened, and make new dealers in one go.",
          },
          {
            href: "/staff",
            title: "Staff logins",
            body: "Who can sign in, and what each person can open. Sales staff never see wages.",
          },
        ].filter((c) => canOpen(me.areas, c.href)).map((c) => (
          <Link key={c.href} href={c.href} className="group">
            <Card className="h-full p-5 transition group-hover:border-accent-line group-hover:shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-base font-bold tracking-tight">{c.title}</div>
                <span className="text-accent transition group-hover:translate-x-0.5">&rarr;</span>
              </div>
              <p className="mt-1.5 text-[13px] text-mute">{c.body}</p>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
