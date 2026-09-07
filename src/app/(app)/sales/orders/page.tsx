import { Notice } from "@/components/ui";
import {
  listCustomers, listGroups, listOrders, listPrices, listProducts,
} from "@/lib/store-sales";
import { OrderHub } from "@/components/order-hub";
import { Customer, CustomerGroup, PriceRow, Product, SalesOrder } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  let orders: SalesOrder[] = [];
  let customers: Customer[] = [];
  let products: Product[] = [];
  let prices: PriceRow[] = [];
  let groups: CustomerGroup[] = [];
  let problem: string | null = null;
  try {
    [orders, customers, products, prices, groups] = await Promise.all([
      listOrders(), listCustomers(), listProducts(), listPrices(), listGroups(),
    ]);
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

  return (
    <OrderHub
      orders={orders} customers={customers} products={products}
      prices={prices} groups={groups}
    />
  );
}
