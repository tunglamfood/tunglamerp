import { describe, expect, it } from "vitest";
import { buildPacking, type Route } from "./packing";
import type { Customer, Product, SalesOrder } from "./types";

const cust = (code: string, name: string, routeCode: string | null, routeSort: number | null = null): Customer => ({
  code, name, shortName: name, state: "", address: `${name} street`, contact: "012", email: null, attn: null, incomeTaxNo: null, active: true, routeCode, routeSort,
});
const prod = (itemCode: string, description: string) => ({ itemCode, description }) as unknown as Product;
let n = 0;
const order = (customerCode: string | null, lines: [string, number, string, string?][], over: Partial<SalesOrder> = {}): SalesOrder => ({
  id: ++n, orderNo: `SO-${n}`, customerCode, orderDate: "2026-11-18", deliverOn: "2026-11-19", status: "confirmed", theirRef: null, note: null,
  lines: lines.map(([itemCode, qty, uom, outletCode], i) => ({ lineNo: i + 1, itemCode, qty, uom, price: 1, note: null, outletCode: outletCode ?? null })),
  ...over,
});

const routes: Route[] = [
  { code: "IPOH", name: "Ipoh town", driver: "Ah Seng", lorry: "AKB 1234", sort: 1, active: true },
  { code: "KL", name: "Klang Valley", driver: null, lorry: null, sort: 2, active: true },
];
const customers = [cust("A", "Ah Beng", "IPOH", 2), cust("B", "Sin Joo", "IPOH", 1), cust("C", "Poon Lee", "KL"), cust("D", "No Route", null), cust("O1", "Outlet One", "KL"), cust("O2", "Outlet Two", "IPOH")];
const products = [prod("TL120", "Egg tofu"), prod("CTN", "Egg tofu carton")];

describe("packing for a delivery day", () => {
  const orders = [
    order("A", [["TL120", 10, "PCS"], ["TL120", 5, "PCS"], ["CTN", 1, "CTN"]]),
    order("B", [["TL120", 20, "PCS"]], { packedAt: "2026-11-18T20:00:00Z" }),
    order("C", [["TL120", 7, "PCS"]]),
    order("D", [["TL120", 3, "PCS"]]),
    order(null, [["TL120", 4, "PCS", "O1"], ["TL120", 6, "PCS", "O2"]], { groupCode: "G" }),
    order("A", [["TL120", 99, "PCS"]], { status: "cancelled" }),
    order("A", [["TL120", 99, "PCS"]], { deliverOn: "2026-11-20" }),
  ];
  const day = buildPacking({ orders, customers, products, routes, delivery: "2026-11-19", includePending: false });

  it("groups stops by route, in route order, with the no-route stops last", () => {
    expect(day.routes.map((r) => r.name)).toEqual(["Ipoh town", "Klang Valley", "No route yet"]);
    expect(day.routes[0].stops.map((s) => s.name)).toEqual(["Sin Joo", "Ah Beng", "Outlet Two"]); // by stop number, then name
  });

  it("packs in the units ordered, adding the same item together", () => {
    const ahBeng = day.routes[0].stops.find((s) => s.name === "Ah Beng")!;
    expect(ahBeng.orders[0].lines).toEqual([
      { itemCode: "TL120", description: "Egg tofu", qty: 15, uom: "PCS" },
      { itemCode: "CTN", description: "Egg tofu carton", qty: 1, uom: "CTN" },
    ]);
  });

  it("splits a chain's sheet into its outlets on their own routes", () => {
    expect(day.routes[1].stops.map((s) => s.name)).toContain("Outlet One");
    expect(day.routes[0].stops.map((s) => s.name)).toContain("Outlet Two");
  });

  it("adds up what each lorry carries and counts what is packed", () => {
    expect(day.routes[0].load).toEqual([
      { itemCode: "TL120", description: "Egg tofu", qty: 41, uom: "PCS" },
      { itemCode: "CTN", description: "Egg tofu carton", qty: 1, uom: "CTN" },
    ].sort((a, b) => a.description.localeCompare(b.description)));
    expect(day.routes[0]).toMatchObject({ orders: 3, packed: 1 });
    expect(day).toMatchObject({ orders: 5, packed: 1, dealers: 6 });
  });
});
