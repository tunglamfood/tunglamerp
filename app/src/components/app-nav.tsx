"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV = [
  { href: "/month", label: "Month" },
  { href: "/workers", label: "Workers" },
] as const;

export function AppNav() {
  const pathname = usePathname();

  async function signOut() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
            TL
          </div>
          <span className="text-sm font-semibold">TungLam HR</span>
        </div>

        <nav className="flex gap-1">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  active
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-mute hover:bg-gray-50 hover:text-ink"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={signOut}
          className="ml-auto min-h-[44px] px-2 text-xs font-medium text-red-500 hover:underline"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
