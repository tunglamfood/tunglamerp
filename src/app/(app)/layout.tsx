// The signed-in shell.
//
// src/proxy.ts already turns away anyone without a valid cookie, but the Next
// docs are explicit that proxy is an optimistic check, not an authorization
// layer. This checks again on the server before rendering anything about wages.
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/supabase-server";
import { countNewPortalOrders } from "@/lib/store-sales";
import { Shell } from "@/components/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await requireSession())) redirect("/login");
  // The badge must never stop the app from opening.
  const newOrders = await countNewPortalOrders().catch(() => 0);
  return <Shell newOrders={newOrders}>{children}</Shell>;
}
