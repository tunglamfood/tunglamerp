import { describe, it, expect } from "vitest";
import { rowToWorker, workerToRow, rowsToDayInputs } from "./store-mapping";
import { Worker } from "./types";

describe("rowToWorker / workerToRow", () => {
  it("round-trips a worker through the database shape", () => {
    const w: Worker = {
      code: "B32",
      scannerId: "2028",
      name: "ISLAM MD NORUL",
      site: "KB",
      group: "B4",
      nationality: "Bangladesh",
      status: "active",
    };
    expect(rowToWorker(workerToRow(w))).toEqual(w);
  });

  it("keeps the group and the scanner ID that the column names disguise", () => {
    expect(
      workerToRow({
        code: "M04",
        scannerId: "",
        name: "THAN WAI PHYO",
        site: "KL",
        group: "B2",
        nationality: null,
        status: "left",
      }),
    ).toMatchObject({ group: "B2", scanner_id: "", nationality: null });
  });
});

describe("rowsToDayInputs", () => {
  it("merges scans with the office's corrections for the same day", () => {
    const inputs = rowsToDayInputs(
      [{ code: "B32", work_date: "2026-06-02", punches: ["07:06"] }],
      [
        {
          code: "B32",
          work_date: "2026-06-02",
          first_override: null,
          last_override: "19:12",
          marked_absent: false,
        },
      ],
    );
    expect(inputs.get("B32")).toEqual([
      {
        date: "2026-06-02",
        punches: ["07:06"],
        firstOverride: null,
        lastOverride: "19:12",
        markedAbsent: false,
      },
    ]);
  });

  it("keeps a correction for a day that was never scanned", () => {
    const inputs = rowsToDayInputs(
      [],
      [
        {
          code: "B32",
          work_date: "2026-06-03",
          first_override: "07:00",
          last_override: "19:00",
          marked_absent: false,
        },
      ],
    );
    expect(inputs.get("B32")![0]).toMatchObject({
      date: "2026-06-03",
      punches: [],
      firstOverride: "07:00",
    });
  });

  it("groups by worker", () => {
    const inputs = rowsToDayInputs(
      [
        { code: "B32", work_date: "2026-06-02", punches: ["07:00", "19:00"] },
        { code: "M04", work_date: "2026-06-02", punches: ["07:10", "18:00"] },
      ],
      [],
    );
    expect([...inputs.keys()].sort()).toEqual(["B32", "M04"]);
  });

  it("returns each worker's days in date order", () => {
    const inputs = rowsToDayInputs(
      [
        { code: "B32", work_date: "2026-06-10", punches: ["07:00", "19:00"] },
        { code: "B32", work_date: "2026-06-02", punches: ["07:00", "19:00"] },
      ],
      [],
    );
    expect(inputs.get("B32")!.map((d) => d.date)).toEqual(["2026-06-02", "2026-06-10"]);
  });
});
