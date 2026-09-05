"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The ERP's own map. Kept deliberately short: everything about a worker lives
 * on the worker page, everything about a month on the month page, each behind
 * tabs. A sidebar with nine HR entries made the system look bigger than it is
 * and hid where things belonged.
 */
export const MODULES = [
  {
    name: "HR",
    ready: true,
    items: [
      { href: "/home", label: "Start here", icon: "home" as const },
      { href: "/month", label: "Monthly pay", icon: "calendar" as const },
      { href: "/workers", label: "Workers", icon: "people" as const },
    ],
  },
  {
    name: "Sales",
    ready: true,
    items: [
      { href: "/sales/orders", label: "Sales orders", icon: "doc" as const },
      { href: "/sales/customers", label: "Customers", icon: "shop" as const },
      { href: "/sales/products", label: "Products", icon: "box" as const },
      { href: "/sales/prices", label: "Price lists", icon: "wallet" as const },
    ],
  },
] as const;

type IconName = "home" | "calendar" | "people" | "shop" | "box" | "doc" | "shield" | "wallet";

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
  };
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] shrink-0">
      <path d={paths[name]} />
    </svg>
  );
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-6 px-3 py-2">
      {MODULES.map((mod) => (
        <div key={mod.name}>
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
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

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
        <NavLinks pathname={pathname} />
        <div className="border-t border-white/10 px-5 py-4">
          <button onClick={signOut}
            className="text-xs font-semibold text-shell-mute transition hover:text-white">
            Sign out
          </button>
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="no-print sticky top-0 z-40 flex h-14 items-center gap-3 bg-shell px-4 md:hidden">
        <button onClick={() => setMenuOpen((v) => !v)} aria-label="Menu"
          className="rounded-lg p-1.5 text-white/80 hover:bg-white/10">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" className="h-5 w-5">
            <path d="M3 6h14M3 10h14M3 14h14" />
          </svg>
        </button>
        {brand}
        <button onClick={signOut} className="ml-auto text-xs font-semibold text-shell-mute">
          Sign out
        </button>
      </header>

      {menuOpen && (
        <div className="no-print fixed inset-0 top-14 z-40 bg-shell md:hidden">
          <NavLinks pathname={pathname} onNavigate={() => setMenuOpen(false)} />
        </div>
      )}

      <main className="p-4 md:ml-60 md:p-8 print:ml-0 print:p-0">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
