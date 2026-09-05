import { Notice } from "@/components/ui";
import { listCustomers, listOrders, listPrices, listProducts } from "@/lib/store-sales";
import { OrdersScreen } from "@/components/orders-screen";
import { Customer, PriceRow, Product, SalesOrder } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  let orders: SalesOrder[] = [];
  let customers: Customer[] = [];
  let products: Product[] = [];
  let prices: PriceRow[] = [];
  let problem: string | null = null;
  try {
    [orders, customers, products, prices] = await Promise.all([listOrders(), listCustomers(), listProducts(), listPrices()]);
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

  return <OrdersScreen orders={orders} customers={customers} products={products} prices={prices} />;
}
