// The signed-in shell.
//
// src/proxy.ts already turns away anyone without a valid cookie, but the Next
// docs are explicit that proxy is an optimistic check, not an authorization
// layer. This checks again on the server — against the person's own row —
// before rendering anything about wages.
import { requireUser } from "@/lib/auth";
import { countNewPortalOrders } from "@/lib/store-sales";
import { countNewLeads } from "@/lib/store-leads";
import { countNewPayments } from "@/lib/store-payments";
import { Shell } from "@/components/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // The badges must never stop the app from opening.
  const sales = user.areas.includes("sales");
  const [newOrders, newLeads, newPayments] = sales
    ? await Promise.all([
        countNewPortalOrders().catch(() => 0),
        countNewLeads().catch(() => 0),
        countNewPayments().catch(() => 0),
      ])
    : [0, 0, 0];
  return (
    <Shell user={{ name: user.name, areas: user.areas }} newOrders={newOrders} newLeads={newLeads} newPayments={newPayments}>
      {children}
    </Shell>
  );
}
