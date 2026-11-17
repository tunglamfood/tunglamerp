// The public website's products, for picking which photo a portal product
// shows. Read from tunglamfood.my/api/catalog — the same products, names and
// photos its own product pages use.
import "server-only";
import { WEBSITE_URL } from "./areas";

export interface WebsiteProduct {
  slug: string;
  name: string;
  weight: string | null;
  category: string | null;
  brand: string | null;
  image: string | null;
}

/** Never throws: without the list, the catalogue screen still works, just without pictures to pick from. */
export async function listWebsiteProducts(): Promise<{ products: WebsiteProduct[]; problem: string | null }> {
  try {
    // WEBSITE_URL may point at a local copy of the website while testing.
    const base = process.env.WEBSITE_URL || WEBSITE_URL;
    const res = await fetch(`${base}/api/catalog`, { next: { revalidate: 300 } });
    if (!res.ok) return { products: [], problem: `tunglamfood.my answered ${res.status}` };
    const data = (await res.json()) as { products?: WebsiteProduct[] };
    return { products: data.products ?? [], problem: null };
  } catch (e) {
    return { products: [], problem: (e as Error).message };
  }
}
