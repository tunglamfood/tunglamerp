// Everything the office must look at before a Million file may be produced.
//
// Half the trial scan data had a single punch. A system that quietly valued
// those days would be worse than the spreadsheet it replaces, so nothing
// incomplete is ever given a number — it is put on this list instead.
import { DayInput, DayResult, Flag, Worker } from "./types";
import { parseTime } from "./time";

export const TOO_LONG_MIN = 16 * 60;
export const TOO_SHORT_MIN = 2 * 60;
/** Pre-filled when someone forgot to scan in or out. */
export const DEFAULT_START = "07:00";
export const DEFAULT_FINISH = "19:00";
/**
 * A lone punch this late in the day is a clock-OUT, not a clock-in — nobody
 * starts a shift at half past eight in the evening. In the trial data 113 of
 * the 244 single-punch days fall here, and treating them as arrivals would put
 * the end of the day before its beginning.
 */
export const LONE_PUNCH_IS_FINISH_AFTER_MIN = 14 * 60;

/** Which way round to read the one scan the worker did make. */
export function suggestFor(
  punch: string,
  defaultStart: string,
  defaultFinish: string,
): { first: string; last: string } {
  const min = parseTime(punch);
  return min != null && min >= LONE_PUNCH_IS_FINISH_AFTER_MIN
    ? { first: defaultStart, last: punch }
    : { first: punch, last: defaultFinish };
}

function flag(partial: Omit<Flag, "punches"> & { punches?: string[] }): Flag {
  return { punches: [], ...partial };
}

export function flagsForWorker(
  worker: Worker,
  days: DayResult[],
  byDate: Map<string, DayInput>,
  defaultFinish: string = DEFAULT_FINISH,
  defaultStart: string = DEFAULT_START,
): Flag[] {
  const out: Flag[] = [];

  for (const day of days) {
    const input = byDate.get(day.date);
    if (input?.markedAbsent) continue; // the office has already ruled on it

    if (day.workedMin != null) {
      // A complete day — only its length can be suspicious, and only on a
      // normal day. Short Saturdays and short holidays are ordinary.
      if (day.workedMin > TOO_LONG_MIN) {
        out.push(
          flag({
            kind: "TOO_LONG",
            code: worker.code,
            name: worker.name,
            date: day.date,
            punches: input?.punches ?? [],
            suggestFirst: null,
            suggestLast: null,
            message: `${worker.name} shows over 16 hours on this day. Almost certainly a missed scan-out — please check both times.`,
          }),
        );
      } else if (day.kind === "NORMAL" && day.workedMin < TOO_SHORT_MIN) {
        out.push(
          flag({
            kind: "TOO_SHORT",
            code: worker.code,
            name: worker.name,
            date: day.date,
            punches: input?.punches ?? [],
            suggestFirst: null,
            suggestLast: null,
            message: `${worker.name} shows under 2 hours on a working day. Please check both times.`,
          }),
        );
      }
      continue;
    }

    // Incomplete. Saturdays and holidays that nobody worked are not problems.
    if (day.kind !== "NORMAL") continue;

    const punches = input?.punches ?? [];
    if (punches.length === 1) {
      const suggestion = suggestFor(punches[0], defaultStart, defaultFinish);
      const missing = suggestion.first === punches[0] ? "finish" : "start";
      out.push(
        flag({
          kind: "SINGLE_PUNCH",
          code: worker.code,
          name: worker.name,
          date: day.date,
          punches,
          suggestFirst: suggestion.first,
          suggestLast: suggestion.last,
          message: `${worker.name} scanned once on this day, so we cannot tell how long they worked. Accept the suggested ${missing} time or correct it.`,
        }),
      );
    } else {
      out.push(
        flag({
          kind: "NO_SCAN",
          code: worker.code,
          name: worker.name,
          date: day.date,
          punches,
          suggestFirst: null,
          suggestLast: null,
          message: `${worker.name} has no scan on this working day. Mark them absent, or key the times in.`,
        }),
      );
    }
  }

  return out;
}

export function flagsForUnmatched(rows: { scannerId: string; name: string }[]): Flag[] {
  return rows.map((r) =>
    flag({
      kind: "UNKNOWN_WORKER",
      code: null,
      name: r.name,
      date: null,
      suggestFirst: null,
      suggestLast: null,
      message: `Scanner ID ${r.scannerId} (${r.name}) is not in your worker list. Add the worker, or ignore these rows.`,
    }),
  );
}

export function flagsForNeverScanned(workers: Worker[], seenCodes: Set<string>): Flag[] {
  return workers
    .filter((w) => w.status === "active" && !seenCodes.has(w.code))
    .map((w) =>
      flag({
        kind: "NEVER_SCANNED",
        code: w.code,
        name: w.name,
        date: null,
        suggestFirst: null,
        suggestLast: null,
        message: `${w.name} (${w.code}) did not scan at all this month. Mark them as left or balik cuti if they have gone.`,
      }),
    );
}
