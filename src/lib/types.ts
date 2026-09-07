// Site, group, nationality and status are the factory's own words, not ours.
// A new site can open, groups get renumbered, somebody is hired from a country
// nobody was hired from before — so these are plain text, chosen from what is
// already in use or typed fresh.
export type Site = string;
export type Group = string;
export type WorkerStatus = string;

/**
 * Status is the one label the payroll reads: only people whose status counts as
 * working are calculated and exported. So a status carries that decision with
 * it rather than being guessed from its name.
 */
export interface WorkerStatusOption {
  name: string;
  countsAsWorking: boolean;
  sortOrder: number;
}

export interface Worker {
  code: string; // Million code — the primary key, e.g. "B32"
  scannerId: string; // CheckTime EMP ID, e.g. "2028". "" until enrolled.
  name: string;
  site: Site;
  group: Group;
  nationality: string | null; // "Bangladesh" | "Myanmar" | "Nepal" | "Malaysia" | null
  status: WorkerStatus;
}

export type DayKind = "NORMAL" | "REST" | "PH";

/** One worker, one calendar date, as read from the scanner plus office corrections. */
export interface DayInput {
  date: string; // "2026-06-02"
  punches: string[]; // ["07:06","12:24","20:24"] in scan order; may be empty
  firstOverride?: string | null; // office-keyed start time, wins over punches[0]
  lastOverride?: string | null; // office-keyed finish time, wins over last punch
  markedAbsent?: boolean; // office says: did not work this day
}

export interface DayResult {
  date: string;
  kind: DayKind;
  workedMin: number | null; // null = no usable pair of times
  basicDay: 0 | 1;
  lunchMin: number;
  otMin: number; // normal days only; negative when they left early
  r2Min: number; // 0 or 15 — the second tea break actually taken off
  restMin: number; // Saturday hours
  phDay: 0 | 1; // credited whether worked or not
  phOtMin: number;
}

export interface MonthTotals {
  code: string;
  workingDays: number;
  basicDays: number;
  otHours: number; // decimal hours, 2dp
  restDayHours: number;
  phDays: number;
  phOtHours: number;
  nonPayLeave: number;
  /**
   * What the old spreadsheet would have printed for overtime: nine minutes
   * taken from every basic day, instead of fifteen taken only from days that
   * passed two hours. Shown beside `otHours` so the correction is visible and
   * can be explained to a worker who asks. See the spec, section 4.4.
   */
  otHoursOldSheet: number;
  r2DifferenceHours: number;
}

/** Allowance and advance, from the office's uploaded sheet. */
export interface PayExtras {
  code: string;
  allowance: number;
  advance: number;
}

export type FlagKind =
  | "SINGLE_PUNCH"
  | "TOO_LONG"
  | "TOO_SHORT"
  | "NO_SCAN"
  | "UNKNOWN_WORKER"
  | "NEVER_SCANNED";

export interface Flag {
  kind: FlagKind;
  code: string | null; // null when the scanner ID matches no worker
  name: string;
  date: string | null; // null for whole-month flags
  punches: string[];
  suggestFirst: string | null; // pre-filled correction offered to the office
  suggestLast: string | null;
  message: string; // plain English, shown as-is on screen
}

/* ── HR stage 2: money and time off ───────────────────────────────────────── */

/**
 * One money line against a worker in a month. `kind` rather than a column each,
 * because the factory keeps inventing kinds — levy this year, hostel the next.
 */
export interface PayItem {
  id?: number;
  monthKey: string;
  code: string;
  kind: string; // allowance | advance | deduction | anything
  label: string; // "Levy", "Hostel", "Attendance"
  amount: number;
  note: string | null;
}

export interface LeaveRecord {
  id?: number;
  code: string;
  kind: string; // Annual | Medical | Hospital | Unpaid | …
  fromDate: string;
  toDate: string;
  days: number;
  paid: boolean;
  note: string | null;
}

/* ── HR stage 3: the things that protect you ──────────────────────────────── */

export interface WorkerDocument {
  id?: number;
  code: string;
  kind: string; // Passport | Work permit | FOMEMA | Insurance
  number: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  note: string | null;
}

export interface Assignment {
  id?: number;
  code: string;
  kind: string; // Hostel | Transport
  value: string;
  fromDate: string | null;
  toDate: string | null;
  note: string | null;
}

/* ── HR stage 4: records ──────────────────────────────────────────────────── */

export interface WorkerNote {
  id?: number;
  code: string;
  kind: string; // Warning | Note | Praise
  onDate: string;
  subject: string;
  detail: string | null;
}
/* ── Sales ────────────────────────────────────────────────────────────────── */

/**
 * Outlets that order together on one sheet and pay one price list.
 *
 * Million knows every outlet as its own debtor, because each is invoiced
 * separately. The group exists only above that: it is who the order form is
 * addressed to, and who the prices belong to.
 */
export interface CustomerGroup {
  code: string;
  name: string;
  active: boolean;
}

export interface Customer {
  code: string; // Million debtor code, '3030/0003'
  name: string;
  shortName: string;
  state: string;
  address: string | null;
  contact: string | null;
  email: string | null;
  attn: string | null;
  incomeTaxNo: string | null;
  active: boolean;
  /** The group this outlet belongs to, if it is one of several. */
  groupCode?: string | null;
  /** SNW, SMY — the heading this outlet gets on an order form. */
  shortCode?: string | null;
}

export interface Product {
  itemCode: string;
  description: string;
  barcode: string | null;
  itemGroup: string;
  itemType: string;
  uom: string;
  packSize: string;
  basePrice: number;
  cost: number;
  active: boolean;
}

/** One dealer's price for one product, from a date. */
export interface PriceRow {
  id?: number;
  /** Exactly one of these is set: a price is one outlet's or a whole group's. */
  customerCode: string | null;
  groupCode?: string | null;
  itemCode: string;
  price: number;
  effectiveFrom: string;
  note: string | null;
}

export type OrderStatus = "draft" | "confirmed" | "delivered" | "cancelled";

export interface OrderLine {
  id?: number;
  lineNo: number;
  itemCode: string;
  qty: number;
  uom: string;
  price: number;
  note: string | null;
  /** Which outlet's column this quantity sits in. Empty on a single-outlet sheet. */
  outletCode?: string | null;
}

/**
 * The batch an item was packed from, written on the sheet after packing.
 *
 * One per item for the whole order: an item is made as one run and split
 * between the outlets afterwards, so the run is what a recall has to trace.
 * Nothing counts as recorded until somebody has confirmed it — which is what
 * keeps a misread photograph out of the traceability trail.
 */
export interface OrderBatch {
  itemCode: string;
  batchCode: string;
  source: "typed" | "photo";
  confirmed: boolean;
  notedAt?: string;
}

export interface SalesOrder {
  id?: number;
  orderNo: string;
  /** Exactly one of these is set: the sheet is one outlet's or a group's. */
  customerCode: string | null;
  groupCode?: string | null;
  orderDate: string;
  deliverOn: string | null;
  status: OrderStatus;
  theirRef: string | null;
  note: string | null;
  lines: OrderLine[];
  batches?: OrderBatch[];
}
