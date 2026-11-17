// Sales → Promotions: promo prices dealers see on the portal, applied when they order.
import { requireArea } from "@/lib/auth";
import { listPromotions, type Promotion } from "@/lib/store-promotions";
import { listCustomers, listGroups, listProducts } from "@/lib/store-sales";
import { Notice } from "@/components/ui";
import { PromotionsScreen } from "@/components/promotions-screen";
import type { Customer, CustomerGroup, Product } from "@/lib/types";

export const dynamic = "force-dynamic";

const todayMY = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

async function load() {
  try {
    const [promotions, products, customers, groups] = await Promise.all([listPromotions(), listProducts(), listCustomers(), listGroups()]);
    return { data: { promotions, products, customers, groups }, problem: null };
  } catch (e) {
    return { data: null as null | { promotions: Promotion[]; products: Product[]; customers: Customer[]; groups: CustomerGroup[] }, problem: (e as Error).message };
  }
}

export default async function PromotionsPage() {
  await requireArea("sales");
  const { data, problem } = await load();
  if (!data) return <Notice tone="bad">Could not load the promotions. {problem}</Notice>;
  return <PromotionsScreen {...data} today={todayMY()} />;
}
