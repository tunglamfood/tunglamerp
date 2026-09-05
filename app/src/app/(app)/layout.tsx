// The signed-in shell.
//
// src/proxy.ts already turns away anyone without a valid cookie, but the Next
// docs are explicit that proxy is an optimistic check, not an authorization
// layer. This checks again on the server before rendering anything about wages.
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/supabase-server";
import { AppNav } from "@/components/app-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await requireSession())) redirect("/login");

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-6xl p-4 md:p-8 print:p-0">{children}</main>
    </div>
  );
}
