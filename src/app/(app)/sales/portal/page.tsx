import { Notice } from "@/components/ui";
import { listCustomers, listGroups, listProducts } from "@/lib/store-sales";
import { listPortalAccounts, listPortalProducts, listReps } from "@/lib/store-portal";
import { PortalHub } from "@/components/portal-screens";

export const dynamic = "force-dynamic";

async function load() {
  try {
    const [accounts, reps, products, customers, groups, items] = await Promise.all([
      listPortalAccounts(), listReps(), listPortalProducts(), listCustomers(), listGroups(), listProducts(),
    ]);
    return { data: { accounts, reps, products, customers, groups, items }, problem: null };
  } catch (e) {
    return { data: null, problem: (e as Error).message };
  }
}

export default async function Page() {
  const { data, problem } = await load();
  if (!data) {
    return <Notice tone="bad">Could not reach the system&rsquo;s storage. {problem}</Notice>;
  }
  return <PortalHub {...data} />;
}
