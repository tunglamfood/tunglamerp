// What each staff login can open. Read by the proxy (every request), the
// server (every page and data route) and the sidebar, so all three agree.
// No server-only imports here: the proxy and the browser both use it.

export type Area = "hr" | "sales" | "production" | "website" | "admin";

export const AREAS: { id: Area; label: string; hint: string }[] = [
  { id: "hr", label: "HR & payroll", hint: "Workers, monthly pay, payslips, public holidays" },
  { id: "sales", label: "Sales & dealers", hint: "Orders, customers, prices, dealer portal, enquiries" },
  { id: "production", label: "Production", hint: "Daily production plan, recipes, lots — no prices or wages" },
  { id: "website", label: "Website content", hint: "The content admin at tunglamfood.my/admin" },
  { id: "admin", label: "Staff logins", hint: "Add people, set what they can open, reset passwords" },
];

export const AREA_LABEL: Record<Area, string> = Object.fromEntries(AREAS.map((a) => [a.id, a.label])) as Record<Area, string>;

/** Which area a path belongs to. Null: any signed-in person may open it. */
const RULES: [prefix: string, area: Area][] = [
  ["/month", "hr"],
  ["/workers", "hr"],
  ["/holidays", "hr"],
  ["/reports", "hr"],
  ["/api/hr", "hr"],
  ["/api/month", "hr"],
  ["/api/workers", "hr"],
  ["/api/reports", "hr"],
  ["/api/statuses", "hr"],
  ["/api/template", "hr"],
  ["/sales", "sales"],
  ["/api/sales", "sales"],
  ["/production", "production"],
  ["/api/production", "production"],
  ["/staff", "admin"],
  ["/api/staff", "admin"],
];

export function areaFor(path: string): Area | null {
  for (const [prefix, area] of RULES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return area;
  }
  return null;
}

export function isArea(v: unknown): v is Area {
  return v === "hr" || v === "sales" || v === "production" || v === "website" || v === "admin";
}

/** True when these areas let someone open that path. */
export function canOpen(areas: readonly string[], path: string): boolean {
  const area = areaFor(path);
  return area === null || areas.includes(area);
}

/** The assistant reads and writes HR and sales data, so it needs one of them. */
export const canUseAssistant = (areas: readonly string[]) => areas.includes("hr") || areas.includes("sales");

/** The public website and its content admin. */
export const WEBSITE_URL = "https://tunglamfood.my";
