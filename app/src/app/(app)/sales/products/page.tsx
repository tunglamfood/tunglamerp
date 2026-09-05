import { Notice } from "@/components/ui";
import { listCustomers, listPrices, listProducts } from "@/lib/store-sales";
import { ProductsScreen } from "@/components/products-screen";
import { Customer, PriceRow, Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  let products: Product[] = [];
  let prices: PriceRow[] = [];
  let customers: Customer[] = [];
  let problem: string | null = null;
  try {
    [products, prices, customers] = await Promise.all([listProducts(), listPrices(), listCustomers()]);
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

  return <ProductsScreen products={products} prices={prices} customers={customers} />;
}
