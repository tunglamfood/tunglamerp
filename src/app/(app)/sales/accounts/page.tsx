// Sales → Accounts & stock: AutoCount's outstanding invoices (aging, dealer statements)
// and stock balance, imported from its exports.
import { requireArea } from "@/lib/auth";
import { lastImports, listInvoices, stockSummary } from "@/lib/store-ar";
import { listCustomers } from "@/lib/store-sales";
import { aging } from "@/lib/ar-import";
import { Notice } from "@/components/ui";
import { AccountsScreen } from "@/components/accounts-screen";

export const dynamic = "force-dynamic";

const todayMY = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

async function load() {
  try {
    const [invoices, imports, stock, customers] = await Promise.all([listInvoices(), lastImports(), stockSummary(), listCustomers()]);
    return { data: { invoices, imports, stock, customers }, problem: null };
  } catch (e) {
    return { data: null, problem: (e as Error).message };
  }
}

export default async function AccountsPage() {
  await requireArea("sales");
  const { data, problem } = await load();
  if (!data) return <Notice tone="bad">Could not load accounts and stock. {problem}</Notice>;
  const names = Object.fromEntries(data.customers.map((c) => [c.code, c.shortName || c.name]));
  return (
    <AccountsScreen
      rows={aging(data.invoices, todayMY())}
      invoices={data.invoices}
      names={names}
      imports={data.imports}
      stock={data.stock}
      today={todayMY()}
    />
  );
}
