import { Notice } from "@/components/ui";
import {
  listCustomers, listGroups, listOrders, listPrices, listProducts,
} from "@/lib/store-sales";
import { OrderHub } from "@/components/order-hub";
import { listPromotions } from "@/lib/store-promotions";
import type { PromoRule } from "@/lib/pricing";
import { Customer, CustomerGroup, PriceRow, Product, SalesOrder } from "@/lib/types";
import { requireArea } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireArea("sales");
  let orders: SalesOrder[] = [];
  let customers: Customer[] = [];
  let products: Product[] = [];
  let prices: PriceRow[] = [];
  let groups: CustomerGroup[] = [];
  let promotions: PromoRule[] = [];
  let problem: string | null = null;
  try {
    [orders, customers, products, prices, groups, promotions] = await Promise.all([
      listOrders(), listCustomers(), listProducts(), listPrices(), listGroups(), listPromotions(),
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
      prices={prices} groups={groups} promotions={promotions}
    />
  );
}
