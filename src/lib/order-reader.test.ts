import { describe, it, expect } from "vitest";
import {
  catalogueFor, isSellable, key, matchOutlet, matchReading, parseReading, readingProblems,
} from "./order-reader";
import { Customer, Product } from "./types";

// KB, KL and TRADING are the groups that hold finished goods; anything else in
// the product list is packaging, raw material or an accounting line.
const product = (itemCode: string, description: string, itemGroup = "KB"): Product => ({
  itemCode, description, barcode: null, itemGroup, itemType: "",
  uom: "PKT", packSize: "", basePrice: 0, cost: 0, active: true,
});

const PRODUCTS: Product[] = [
  product("TK4P", "TAUFU KERAS 4PCS (400GM)"),
  product("TK6P", "TAUFU KERAS 6PCS (600GM)"),
  product("TK1KG", "TAUFU KERAS 10PCS (1KG)"),
  product("AD3X1", "EGG TOFU - AD 3X120GM"),
  product("CGK160", "CILI BEBOLA GORENG KECIL 160GM"),
];

const ALIASES: Record<string, string> = {
  TK4P: "TK400GM", TK6P: "TK600GM", TK1KG: "TK1KG",
  AD3X1: "AD (3X120GM)", CGK160: "CILI (GK) 160GM",
};

const customer = (code: string, name: string, shortCode = ""): Customer => ({
  code, name, shortName: name, state: "Selangor", address: null,
  contact: null, email: null, attn: null, incomeTaxNo: null, active: true, shortCode,
});

const OUTLETS: Customer[] = [
  customer("3030/0211", "ST ROSYAM MART SDN BHD ( SEMENYIH) ST SMY", "SMY"),
  customer("3030/0225", "ST ROSYAM MART SDN BHD ( SENAWANG ) ST SNW", "SNW"),
  customer("3030/0166", "SRI TERNAK FOOD MART SDN BHD - ST SLY", "SLY"),
  customer("3030/0167", "ST ROSYAM MART SDN BHD - ST SW", "SW"),
];

/** What the branches are called by everyone who is not Million. */
const OUTLET_ALIASES: Record<string, string> = {
  SEMENYIH: "3030/0211", SENAWANG: "3030/0225",
  SELAYANG: "3030/0166", SETIAWANGSA: "3030/0167",
};

describe("parseReading", () => {
  it("reads the agreed shape", () => {
    const r = parseReading('{"lines":[{"itemText":"TK400GM","outletText":"SMY","qty":10}],"deliverOn":"2026-09-07","note":""}');
    expect(r?.lines).toEqual([{ itemText: "TK400GM", outletText: "SMY", qty: 10 }]);
    expect(r?.deliverOn).toBe("2026-09-07");
    expect(r?.note).toBeNull();
  });

  it("copes with the model fencing its answer in a code block", () => {
    const r = parseReading('```json\n{"lines":[{"itemText":"X","qty":2}]}\n```');
    expect(r?.lines).toHaveLength(1);
    expect(r?.lines[0].outletText).toBe("");
  });

  it("refuses an answer that is not the agreed shape", () => {
    // Half an order picked is worse than none, because nobody knows which half.
    expect(parseReading("I could not read that order, sorry.")).toBeNull();
    expect(parseReading('{"items":[]}')).toBeNull();
    expect(parseReading("")).toBeNull();
  });

  it("drops a line with no quantity rather than inventing one", () => {
    const r = parseReading('{"lines":[{"itemText":"A","qty":0},{"itemText":"B","qty":"?"},{"itemText":"C","qty":3}]}');
    expect(r?.lines.map((l) => l.itemText)).toEqual(["C"]);
  });

  it("ignores a delivery date that is not a date", () => {
    expect(parseReading('{"lines":[{"itemText":"A","qty":1}],"deliverOn":"next monday"}')?.deliverOn)
      .toBeNull();
  });
});

describe("matching an item", () => {
  const read = (itemText: string, qty = 1, outletText = "") =>
    matchReading({ lines: [{ itemText, outletText, qty }], deliverOn: null, note: null },
      PRODUCTS, ALIASES, OUTLETS).lines[0];

  it("settles the office's own shorthand first", () => {
    expect(read("TK400GM")).toMatchObject({ itemCode: "TK4P", how: "alias" });
    expect(read("AD (3X120GM)")).toMatchObject({ itemCode: "AD3X1", how: "alias" });
  });

  it("does not care about spaces or capitals", () => {
    expect(read("tk 400 gm").itemCode).toBe("TK4P");
    expect(read("ad(3x120gm)").itemCode).toBe("AD3X1");
  });

  it("settles a Million code", () => {
    expect(read("CGK160")).toMatchObject({ itemCode: "CGK160", how: "code" });
  });

  it("settles a full product name", () => {
    expect(read("TAUFU KERAS 6PCS (600GM)")).toMatchObject({ itemCode: "TK6P", how: "name" });
  });

  it("leaves a line unmatched rather than guessing", () => {
    const line = read("PUFF BULAT 10PCS");
    expect(line.itemCode).toBeNull();
    expect(line.how).toBe("none");
    // The text is kept exactly, so the office can see what it was.
    expect(line.itemText).toBe("PUFF BULAT 10PCS");
  });

  it("refuses to choose when two products could be meant", () => {
    // "TAUFU KERAS" matches three. A coin toss here picks and invoices the
    // wrong item, so it stays a decision for a person.
    expect(read("TAUFU KERAS").itemCode).toBeNull();
  });

  it("takes a single clear partial match", () => {
    expect(read("CILI BEBOLA GORENG KECIL").itemCode).toBe("CGK160");
  });

  it("carries the real product name back for the office to check", () => {
    expect(read("TK1KG").itemName).toBe("TAUFU KERAS 10PCS (1KG)");
  });
});

describe("matching an outlet", () => {
  it("recognises the short code the orders use", () => {
    expect(matchOutlet("SMY", OUTLETS)?.code).toBe("3030/0211");
    expect(matchOutlet("SNW", OUTLETS)?.code).toBe("3030/0225");
  });

  it("recognises the branch name", () => {
    expect(matchOutlet("Semenyih", OUTLETS)?.code).toBe("3030/0211");
    expect(matchOutlet("senawang", OUTLETS)?.code).toBe("3030/0225");
  });

  it("recognises a branch the Million name never mentions", () => {
    // The Setiawangsa shop is recorded as "ST ROSYAM MART SDN BHD - ST SW".
    // Nothing in that name is the word the customer writes.
    expect(matchOutlet("SETIAWANGSA", OUTLETS)).toBeUndefined();
    expect(matchOutlet("SETIAWANGSA", OUTLETS, OUTLET_ALIASES)?.code).toBe("3030/0167");
    expect(matchOutlet("Selayang", OUTLETS, OUTLET_ALIASES)?.code).toBe("3030/0166");
  });

  it("recognises the Million code itself", () => {
    expect(matchOutlet("3030/0166", OUTLETS)?.code).toBe("3030/0166");
  });

  it("takes the only outlet when the order names none", () => {
    expect(matchOutlet("", [OUTLETS[0]])?.code).toBe("3030/0211");
  });

  it("will not choose between outlets when the order names none", () => {
    expect(matchOutlet("", OUTLETS)).toBeUndefined();
  });

  it("will not choose when the name fits more than one", () => {
    expect(matchOutlet("ST ROSYAM", OUTLETS)).toBeUndefined();
  });
});

describe("what the office has to settle", () => {
  const reading = (lines: { itemText: string; outletText?: string; qty: number }[]) =>
    matchReading(
      { lines: lines.map((l) => ({ outletText: "", ...l })), deliverOn: null, note: null },
      PRODUCTS, ALIASES, OUTLETS,
    );

  it("names the lines that match no product", () => {
    const r = reading([{ itemText: "TK400GM", outletText: "SMY", qty: 1 },
                       { itemText: "SOMETHING ELSE", outletText: "SMY", qty: 2 }]);
    const p = readingProblems(r, 3);
    expect(p[0]).toContain("match any product");
    expect(p[0]).toContain('"SOMETHING ELSE"');
    expect(p[0]).not.toContain("TK400GM");
  });

  it("says when a line does not say which outlet", () => {
    const r = reading([{ itemText: "TK400GM", qty: 1 }]);
    expect(readingProblems(r, 3).some((x) => x.includes("which outlet"))).toBe(true);
  });

  it("does not ask about outlets when there is only one", () => {
    const r = reading([{ itemText: "TK400GM", qty: 1 }]);
    expect(readingProblems(r, 1).some((x) => x.includes("which outlet"))).toBe(false);
  });

  it("flags the softer matches as worth checking", () => {
    const r = reading([{ itemText: "TAUFU KERAS 6PCS (600GM)", outletText: "SMY", qty: 1 }]);
    expect(readingProblems(r, 3).some((x) => x.includes("matched on the product name"))).toBe(true);
  });

  it("says so when nothing could be read at all", () => {
    expect(readingProblems(reading([]), 3)).toEqual([
      "Nothing on this order could be read as a line.",
    ]);
  });

  it("is silent when every line is settled by shorthand", () => {
    const r = reading([{ itemText: "TK400GM", outletText: "SMY", qty: 1 },
                       { itemText: "TK1KG", outletText: "SNW", qty: 4 }]);
    expect(readingProblems(r, 3)).toEqual([]);
  });
});

describe("the catalogue the model is shown", () => {
  it("carries the shorthand as well as the name", () => {
    const c = catalogueFor(PRODUCTS, ALIASES);
    expect(c).toContainEqual({ code: "TK4P", alias: "TK400GM", name: "TAUFU KERAS 4PCS (400GM)" });
  });

  it("leaves out anything no longer sold", () => {
    const c = catalogueFor([...PRODUCTS, { ...product("OLD", "OLD THING"), active: false }], ALIASES);
    expect(c.map((x) => x.code)).not.toContain("OLD");
  });
});

describe("key", () => {
  it("brings the same thing written differently together", () => {
    expect(key("TK 400GM")).toBe(key("tk400gm"));
    expect(key("AD (3X120GM)")).toBe("AD3X120GM");
  });
});

describe("only things we actually sell", () => {
  // The product list also holds packaging film, raw materials and an
  // ADVERTISEMENT line. Before this rule, "cincau asli 2kg" matched
  // "PE PRINTED BAG - CINCAU ASLI 2KG" — the bag, not the cincau.
  const MIXED: Product[] = [
    ...PRODUCTS,
    product("CT2KG", "CINCAU TRADITIONAL 2KG (ASLI)", "KB"),
    product("PM0024", "PE PRINTED BAG - CINCAU ASLI 2KG (CT2KG)", ""),
    product("PM0058", "FILM - AD KEK IKAN 450GM ( ADKIP450)", ""),
    product("RM0045", "TAUFU KERAS 100GM", ""),
    product("WST001", "WASTE", "WASTE"),
  ];

  const read = (itemText: string) =>
    matchReading({ lines: [{ itemText, outletText: "SMY", qty: 1 }], deliverOn: null, note: null },
      MIXED, ALIASES, OUTLETS, OUTLET_ALIASES).lines[0];

  it("knows what is sellable", () => {
    expect(isSellable(product("X", "X", "KB"))).toBe(true);
    expect(isSellable(product("X", "X", "KL"))).toBe(true);
    expect(isSellable(product("X", "X", "TRADING"))).toBe(true);
    expect(isSellable(product("X", "X", ""))).toBe(false);
    expect(isSellable(product("X", "X", "WASTE"))).toBe(false);
    expect(isSellable({ ...product("X", "X", "KB"), active: false })).toBe(false);
  });

  it("will not pick the bag when the cincau is meant", () => {
    // The customer writes "cincau asli 2kg". Our product is named "CINCAU
    // TRADITIONAL 2KG (ASLI)", which those words do not match — so the line
    // comes back unsettled for the office. Before packaging was excluded it
    // matched "PE PRINTED BAG - CINCAU ASLI 2KG" exactly, and a bag would have
    // been picked, packed and invoiced as cincau. Unmatched is the better wrong
    // answer, and the cure is an alias, not a looser match.
    const line = read("cincau asli 2kg");
    expect(line.itemCode).toBeNull();
    expect(line.itemText).toBe("cincau asli 2kg");
  });

  it("matches the cincau once the office has named it", () => {
    const withAlias = { ...ALIASES, CT2KG: "CINCAU ASLI 2KG" };
    const line = matchReading(
      { lines: [{ itemText: "cincau asli 2kg", outletText: "SMY", qty: 1 }], deliverOn: null, note: null },
      MIXED, withAlias, OUTLETS, OUTLET_ALIASES,
    ).lines[0];
    expect(line.itemCode).toBe("CT2KG");
    expect(line.how).toBe("alias");
  });

  it("will not order a roll of film", () => {
    expect(read("FILM - AD KEK IKAN 450GM ( ADKIP450)").itemCode).toBeNull();
    expect(read("PM0058").itemCode).toBeNull();
  });

  it("keeps packaging out of what the model is shown", () => {
    const codes = catalogueFor(MIXED, ALIASES).map((c) => c.code);
    expect(codes).toContain("CT2KG");
    expect(codes).not.toContain("PM0024");
    expect(codes).not.toContain("RM0045");
    expect(codes).not.toContain("WST001");
  });
});
