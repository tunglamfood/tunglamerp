import { Notice } from "@/components/ui";
import { listCustomers } from "@/lib/store-sales";
import { CustomersScreen } from "@/components/customers-screen";
import { Customer } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  let customers: Customer[] = [];
  let problem: string | null = null;
  try {
    [customers] = await Promise.all([listCustomers()]);
  } catch (e) {
    problem = (e as Error).message;
  }

  if (problem) {
    return (
      <Notice tone="bad">
        Could not reach the system&rsquo;s storage. {problem}
      </Notice>
    );
  }

  return <CustomersScreen customers={customers} />;
}
