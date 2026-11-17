// Sales → Enquiries: the contact forms on tunglamfood.my, followed up here.
import { requireArea } from "@/lib/auth";
import { listLeads } from "@/lib/store-leads";
import { listCustomers } from "@/lib/store-sales";
import { Notice } from "@/components/ui";
import { LeadsScreen } from "@/components/leads-screen";

export const dynamic = "force-dynamic";

async function load() {
  try {
    const [leads, customers] = await Promise.all([listLeads(), listCustomers()]);
    return { leads, customers, problem: null };
  } catch (e) {
    return { leads: null, customers: null, problem: (e as Error).message };
  }
}

export default async function EnquiriesPage() {
  await requireArea("sales");
  const { leads, customers, problem } = await load();
  if (!leads || !customers) return <Notice tone="bad">Could not load the enquiries. {problem}</Notice>;
  return (
    <LeadsScreen
      leads={leads}
      customers={customers.filter((c) => c.active).map((c) => ({ code: c.code, name: c.shortName || c.name }))}
    />
  );
}
