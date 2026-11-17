import { describe, expect, it } from "vitest";
import { aging, parseDate, parseNum, readAr, readStock } from "./ar-import";

describe("reading AutoCount numbers and dates", () => {
  it("reads money the ways reports print it", () => {
    expect(parseNum("1,234.50")).toBe(1234.5);
    expect(parseNum("(200.00)")).toBe(-200);
    expect(parseNum("150.00 CR")).toBe(-150);
    expect(parseNum("RM 88")).toBe(88);
    expect(parseNum(12.3)).toBe(12.3);
    expect(parseNum("")).toBeNull();
    expect(parseNum("Total")).toBeNull();
  });

  it("reads dates as Excel numbers, dd/MM/yyyy, ISO and 15-Nov-2026", () => {
    expect(parseDate(46343)).toBe("2026-11-17");
    expect(parseDate("17/11/2026")).toBe("2026-11-17");
    expect(parseDate("1/2/26")).toBe("2026-02-01");
    expect(parseDate("2026-11-17")).toBe("2026-11-17");
    expect(parseDate("15-Nov-2026")).toBe("2026-11-15");
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});

describe("outstanding invoices", () => {
  const sheet = [
    ["TUNG LAM FOOD INDUSTRIES SDN BHD"],
    ["Outstanding Invoice Listing as at 17/11/2026"],
    [],
    ["Debtor Code", "Debtor Name", "Doc No.", "Doc Date", "Due Date", "Local Net Total", "Outstanding"],
    ["3030/0003", "FOUR THREE THREE", "IV-00101", "01/10/2026", "31/10/2026", "1,200.00", "1,200.00"],
    ["3030/0003", "FOUR THREE THREE", "IV-00140", "05/11/2026", "05/12/2026", "800.00", "300.00"],
    ["", "", "", "", "", "Total", "1,500.00"],
    ["3030/0084", "POON LEE", "IV-00150", "bad date", "", "50.00", "50.00"],
  ];

  it("finds the heading row under the report title and reads each document", () => {
    const r = readAr(sheet);
    expect(r.error).toBeUndefined();
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ customerCode: "3030/0003", docNo: "IV-00101", docDate: "2026-10-01", dueDate: "2026-10-31", amount: 1200, outstanding: 1200 });
    expect(r.skipped).toEqual([{ line: 8, reason: "IV-00150: date not readable" }]);
  });

  it("says which headings it needs when it cannot find them", () => {
    expect(readAr([["Name", "Phone"]]).error).toMatch(/Debtor Code/);
  });

  it("buckets what is owed by days overdue", () => {
    const r = readAr(sheet).rows;
    const [a] = aging(r, "2026-11-17");
    expect(a).toMatchObject({ customerCode: "3030/0003", d30: 1200, current: 300, total: 1500, oldest: "2026-10-01" });
  });
});

describe("stock balance", () => {
  it("adds up an item held in several locations", () => {
    const r = readStock([
      ["Stock Balance Report"],
      ["Item Code", "Description", "Location", "UOM", "Balance Qty"],
      ["TL120", "Egg tofu", "HQ", "PCS", "120"],
      ["TL120", "Egg tofu", "STORE2", "PCS", "30"],
      ["TK4P", "Tau kwa", "HQ", "PKT", "0"],
    ]);
    expect(r.rows).toEqual([{ itemCode: "TL120", qty: 150, uom: "PCS" }, { itemCode: "TK4P", qty: 0, uom: "PKT" }]);
  });
});
