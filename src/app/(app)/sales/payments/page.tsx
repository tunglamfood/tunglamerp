// Sales → Payments: bank slips dealers sent from the portal.
import { requireArea } from "@/lib/auth";
import { listPayments, type PortalPayment } from "@/lib/store-payments";
import { Notice } from "@/components/ui";
import { PaymentsScreen } from "@/components/payments-screen";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  await requireArea("sales");
  let payments: PortalPayment[] | null = null;
  let problem: string | null = null;
  try {
    payments = await listPayments();
  } catch (e) {
    problem = (e as Error).message;
  }
  if (!payments) return <Notice tone="bad">Could not load the payment slips. {problem}</Notice>;
  return <PaymentsScreen payments={payments} />;
}
