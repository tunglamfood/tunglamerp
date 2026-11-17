"use client";
// Sales orders and the picking sheet are the same job seen two ways — the list
// of what has been ordered, and the form the factory works from — so they share
// a page rather than two sidebar entries. The order list comes first: it is where
// new portal orders arrive.
import { Tabs } from "@/components/tabs";
import { OrdersScreen } from "@/components/orders-screen";
import { SheetScreen } from "@/components/sheet-screen";
import { Customer, CustomerGroup, PriceRow, Product, SalesOrder } from "@/lib/types";

export function OrderHub({
  orders, customers, products, prices, groups,
}: {
  orders: SalesOrder[];
  customers: Customer[];
  products: Product[];
  prices: PriceRow[];
  groups: CustomerGroup[];
}) {
  return (
    <Tabs
      tabs={[
        {
          id: "orders",
          label: "All orders",
          note: String(orders.length),
          panel: (
            <OrdersScreen
              orders={orders} customers={customers} products={products} prices={prices}
            />
          ),
        },
        {
          id: "sheet",
          label: "Order form",
          note: groups.length > 0 ? String(groups.length) : undefined,
          panel: <SheetScreen groups={groups} products={products} />,
        },
      ]}
    />
  );
}
