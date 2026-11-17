"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Assistant } from "@/components/assistant";
import { WEBSITE_URL, canOpen, canUseAssistant, type Area } from "@/lib/areas";

/**
 * The ERP's own map. Kept deliberately short: everything about a worker lives
 * on the worker page, everything about a month on the month page, each behind
 * tabs. A sidebar with nine HR entries made the system look bigger than it is
 * and hid where things belonged.
 */
export const MODULES = [
  {
    name: "",
    ready: true,
    items: [
      { href: "/home", label: "Dashboard", icon: "home" as const },
      { href: "/assistant", label: "Assistant", icon: "spark" as const },
    ],
  },
  {
    name: "HR",
    ready: true,
    items: [
      { href: "/month", label: "Monthly pay", icon: "calendar" as const },
      { href: "/workers", label: "Workers", icon: "people" as const },
      { href: "/holidays", label: "Public holidays", icon: "calendar" as const },
      { href: "/reports/payslips", label: "Payslips", icon: "doc" as const },
    ],
  },
  {
    name: "Sales",
    ready: true,
    items: [
      { href: "/sales/orders", label: "Sales orders", icon: "doc" as const },
      { href: "/sales/enquiries", label: "Enquiries", icon: "inbox" as const },
      { href: "/sales/payments", label: "Payments", icon: "wallet" as const },
      { href: "/sales/promotions", label: "Promotions", icon: "tag" as const },
      { href: "/sales/accounts", label: "Accounts & stock", icon: "ledger" as const },
      { href: "/sales/visits", label: "Visits", icon: "pin" as const },
      { href: "/sales/reports", label: "Sales report", icon: "chart" as const },
      { href: "/sales/customers", label: "Customers", icon: "shop" as const },
      { href: "/sales/products", label: "Products", icon: "box" as const },
      { href: "/sales/prices", label: "Price lists", icon: "wallet" as const },
      { href: "/sales/portal", label: "Dealer portal", icon: "people" as const },
    ],
  },
  {
    name: "Production",
    ready: true,
    items: [
      { href: "/production/plan", label: "Daily plan", icon: "factory" as const },
      { href: "/production/packing", label: "Packing & delivery", icon: "truck" as const },
      { href: "/production/setup", label: "Recipes & setup", icon: "box" as const },
      { href: "/production/trace", label: "Trace a lot", icon: "search" as const },
      { href: "/production/routes", label: "Routes", icon: "pin" as const },
    ],
  },
  {
    name: "Admin",
    ready: true,
    items: [{ href: "/staff", label: "Staff logins", icon: "shield" as const }],
  },
] as const;

/** The website and the dealer portal, which live on tunglamfood.my. */
const WEBSITE_LINKS: { href: string; label: string; area: Area; icon: IconName }[] = [
  { href: `${WEBSITE_URL}/admin`, label: "Website admin", area: "website", icon: "globe" },
  { href: `${WEBSITE_URL}/portal`, label: "Dealer portal (live)", area: "sales", icon: "external" },
];

type IconName = "home" | "calendar" | "people" | "shop" | "box" | "doc" | "shield" | "wallet" | "spark" | "inbox" | "globe" | "external" | "chart" | "pin" | "tag" | "ledger" | "factory" | "search" | "truck";

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = {
    home: "M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-4v-4H8v4H4a1 1 0 0 1-1-1V9.5Z",
    calendar: "M4 5h12v11H4V5Zm0 3.5h12M7.5 3v3M12.5 3v3",
    people: "M7 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm6 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM2.5 16c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4M13 12c2.2 0 4 1.3 4 3.5",
    shop: "M3 7h14l-1 9H4L3 7Zm3 0V5a4 4 0 0 1 8 0v2",
    box: "M10 3 3 6.5v7L10 17l7-3.5v-7L10 3Zm0 0v14M3 6.5l7 3.5 7-3.5",
    doc: "M5 3h6l4 4v10H5V3Zm6 0v4h4M7.5 11h5M7.5 14h5",
    shield: "M10 3 4 5.5V10c0 3.5 2.5 6 6 7 3.5-1 6-3.5 6-7V5.5L10 3Z",
    wallet: "M3 6h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H3V6Zm0 0V5a1 1 0 0 1 1-1h9M14 11h.01",
    spark: "M10 2.5 11.6 7l4.4 1.6L11.6 10 10 14.5 8.4 10 4 8.6 8.4 7 10 2.5Z",
    inbox: "M3 11.5 5.2 4.6A1 1 0 0 1 6.2 4h7.6a1 1 0 0 1 1 .6L17 11.5V16H3v-4.5Zm0 0h4l1 2h4l1-2h4",
    globe: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm-7-7h14M10 3c2 2 2.8 4.4 2.8 7S12 15 10 17c-2-2-2.8-4.4-2.8-7S8 5 10 3Z",
    external: "M11 4h5v5M16 4l-7 7M14 11.5V15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3.5",
    chart: "M4 16V9m4 7V5m4 11v-5m4 5V7M3 16.5h14",
    pin: "M10 17s5-4.6 5-8.5A5 5 0 0 0 5 8.5C5 12.4 10 17 10 17Zm0-6.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
    tag: "M3 10.6V4h6.6l7 7-6.6 6.6-7-7ZM7 7.5h.01",
    ledger: "M4 3.5h9l3 3V16.5H4v-13Zm3 5h6M7 11h6M7 14h4",
    factory: "M3 16.5V8l4 2.5V8l4 2.5V8l4 2.5V4h2v12.5H3Zm3-3h1m3 0h1m3 0h1",
    search: "M9 14.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Zm4-1.5 3.5 3.5",
    truck: "M2.5 5.5h9v8h-9v-8Zm9 3h3l2.5 2.5v2.5h-5.5M5.5 15.5a1.5 1.5 0 1 0 0-.01M14 15.5a1.5 1.5 0 1 0 0-.01",
  };
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] shrink-0">
      <path d={paths[name]} />
    </svg>
  );
}

function NavLinks({
  pathname, onNavigate, badges = {}, areas,
}: { pathname: string; onNavigate?: () => void; badges?: Record<string, number>; areas: readonly string[] }) {
  const modules = MODULES.map((mod) => ({
    ...mod,
    items: mod.items.filter((item) => canOpen(areas, item.href) && (item.href !== "/assistant" || canUseAssistant(areas))),
  })).filter((mod) => mod.items.length > 0);
  const outside = WEBSITE_LINKS.filter((l) => areas.includes(l.area));
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
      {modules.map((mod) => (
        <div key={mod.name}>
          {mod.name && (
          <div className="mb-1.5 flex items-center gap-2 px-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-shell-mute">
              {mod.name}
            </span>
            {!mod.ready && (
              <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-shell-mute">
                later
              </span>
            )}
          </div>
          )}
          <div className="space-y-0.5">
            {mod.items.map((item) => {
              const active = mod.ready && pathname.startsWith(item.href);
              if (!mod.ready) {
                return (
                  <div key={item.label}
                    className="flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-shell-mute/50">
                    <Icon name={item.icon} />
                    {item.label}
                  </div>
                );
              }
              return (
                <Link key={item.href} href={item.href} onClick={onNavigate}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                    active
                      ? "bg-accent text-white shadow-sm"
                      : "text-white/70 hover:bg-white/8 hover:text-white"
                  }`}>
                  <Icon name={item.icon} />
                  <span className="flex-1">{item.label}</span>
                  {(badges[item.href] ?? 0) > 0 && (
                    <span
                      className="nums min-w-5 rounded-full bg-red-500 px-1.5 text-center text-[11px] font-bold leading-5 text-white shadow-sm"
                      title={`${badges[item.href]} new`}
                    >
                      {badges[item.href]}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
      {outside.length > 0 && (
        <div>
          <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-shell-mute">
            tunglamfood.my
          </div>
          <div className="space-y-0.5">
            {outside.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noopener"
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/70 transition hover:bg-white/8 hover:text-white">
                <Icon name={l.icon} />
                <span className="flex-1">{l.label}</span>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
                  strokeLinejoin="round" className="h-3.5 w-3.5 text-shell-mute" aria-hidden>
                  <path d="M8 5h7v7M15 5l-9 9" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

export function Shell({
  children, user, newOrders = 0, newLeads = 0, newPayments = 0,
}: {
  children: React.ReactNode;
  user: { name: string; areas: Area[] };
  newOrders?: number;
  newLeads?: number;
  newPayments?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  // Portal orders waiting for the office. The server sends a fresh number with every page;
  // in between, check every 30 seconds and whenever the window comes back into focus.
  const sales = user.areas.includes("sales");
  const [count, setCount] = useState(newOrders);
  const [leads, setLeads] = useState(newLeads);
  const [slips, setSlips] = useState(newPayments);
  const serverKey = `${newOrders}/${newLeads}/${newPayments}`;
  const [fromServer, setFromServer] = useState(serverKey);
  if (serverKey !== fromServer) {
    setFromServer(serverKey);
    setCount(newOrders);
    setLeads(newLeads);
    setSlips(newPayments);
  }
  useEffect(() => {
    if (!sales) return;
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch("/api/sales/orders/new-count", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as { value?: { count?: number; leads?: number; payments?: number } };
        if (!alive) return;
        if (typeof j.value?.count === "number") setCount(j.value.count);
        if (typeof j.value?.leads === "number") setLeads(j.value.leads);
        if (typeof j.value?.payments === "number") setSlips(j.value.payments);
      } catch {
        /* offline: keep the last number */
      }
    };
    const timer = setInterval(check, 30_000);
    window.addEventListener("focus", check);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [sales]);
  const badges = { "/sales/orders": count, "/sales/enquiries": leads, "/sales/payments": slips };
  const waiting = count + leads + slips;

  // The assistant fills the screen and scrolls inside itself, so the page
  // around it must not scroll as well — two scrollbars fighting is worse than
  // either. It also carries its own Ask box, so the floating button would only
  // be in the way there.
  const fillsScreen = pathname.startsWith("/assistant");

  async function signOut() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const brand = (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-[13px] font-extrabold tracking-tight text-white">
        TL
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-bold tracking-tight text-white">TungLam ERP</div>
        <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-shell-mute">
          Food Industries
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-shell md:flex">
        <div className="px-5 py-5">{brand}</div>
        <NavLinks pathname={pathname} badges={badges} areas={user.areas} />
        <div className="flex items-center gap-2.5 border-t border-white/10 px-4 py-3.5">
          <Link href="/account" title="My account"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 transition hover:bg-white/8">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[13px] font-bold text-white">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[13px] font-semibold text-white">{user.name}</span>
              <span className="block text-[11px] text-shell-mute">My account</span>
            </span>
          </Link>
          <button onClick={signOut}
            className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-shell-mute transition hover:bg-white/8 hover:text-white">
            Sign out
          </button>
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="no-print sticky top-0 z-40 flex h-14 items-center gap-3 bg-shell px-4 md:hidden">
        <button onClick={() => setMenuOpen((v) => !v)} aria-label="Menu"
          className="relative rounded-lg p-1.5 text-white/80 hover:bg-white/10">
          {waiting > 0 && <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-shell" />}
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" className="h-5 w-5">
            <path d="M3 6h14M3 10h14M3 14h14" />
          </svg>
        </button>
        {brand}
        <Link href="/account" aria-label="My account"
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[13px] font-bold text-white">
          {user.name.slice(0, 1).toUpperCase()}
        </Link>
      </header>

      {menuOpen && (
        <div className="no-print fixed inset-0 top-14 z-[45] flex flex-col bg-shell md:hidden">
          <NavLinks pathname={pathname} badges={badges} areas={user.areas} onNavigate={() => setMenuOpen(false)} />
          <div className="flex items-center gap-3 border-t border-white/10 px-5 py-4">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{user.name}</span>
            <button onClick={signOut} className="rounded-lg px-3 py-2 text-sm font-semibold text-shell-mute hover:bg-white/8 hover:text-white">
              Sign out
            </button>
          </div>
        </div>
      )}

      <main
        className={
          fillsScreen
            ? "h-[calc(100dvh-3.5rem)] overflow-hidden p-4 md:ml-60 md:h-dvh md:p-6 print:ml-0 print:p-0"
            : "p-4 pb-24 md:ml-60 md:p-8 md:pb-24 print:ml-0 print:p-0"
        }
      >
        <div className={`mx-auto max-w-6xl ${fillsScreen ? "h-full" : ""}`}>{children}</div>
      </main>

      {/* Reachable from every screen — it is meant to be asked something while
          you are already looking at something else. */}
      {!fillsScreen && canUseAssistant(user.areas) && <Assistant />}
    </div>
  );
}
