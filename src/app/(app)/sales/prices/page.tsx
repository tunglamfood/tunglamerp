import { Notice } from "@/components/ui";
import { listCustomers, listPrices, listProducts } from "@/lib/store-sales";
import { PricesScreen } from "@/components/prices-screen";
import { Customer, PriceRow, Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  let customers: Customer[] = [];
  let products: Product[] = [];
  let prices: PriceRow[] = [];
  let problem: string | null = null;
  try {
    [customers, products, prices] = await Promise.all([listCustomers(), listProducts(), listPrices()]);
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

  return <PricesScreen customers={customers} products={products} prices={prices} />;
}
