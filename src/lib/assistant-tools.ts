// What the assistant is allowed to do.
//
// Two rules shape this list. Reading is free — it can look at anything, because
// looking cannot hurt. Writing is narrow and one record at a time: there is no
// tool here that deletes, and none that changes many rows at once, so the worst
// a misunderstanding can do is add one row somebody can see and remove.
import "server-only";
import { listStatuses, listWorkers, upsertWorker } from "./store";
import {
  listAssignments, listDocuments, listLeave, listNotes, listPayItems,
  saveDocument, saveLeave, saveNote, savePayItem,
} from "./store-hr";
import {
  listCustomers, listOrders, listPrices, listProducts, setPrice,
  upsertCustomer, upsertProduct,
} from "./store-sales";
import { loadMonthView, monthExtras } from "./month-loader";
import { listHolidays, saveHoliday } from "./store-holidays";
import { currentListFor } from "./pricing";
import { expiryLevel, expiryWords } from "./expiry";

/**
 * A tool, described without reference to any one provider's SDK. The route
 * turns these into whatever shape the model it is calling expects.
 */
export interface AssistantTool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

export interface ToolOutcome {
  /** What the model gets back. */
  result: unknown;
  /** Set on a tool that changed something, for the office to see afterwards. */
  changed?: string;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Keeps a reply small enough to be useful — the model does not need 346 rows.
 *
 * A truncated list is dangerous for counting: handed 60 of 85 workers, a model
 * will happily count the 60 and report the answer with confidence. So a cut
 * list says so in the payload, in words, and every tool that could be counted
 * from carries its own totals worked out over the whole set.
 */
function cap<T>(
  rows: T[],
  limit = 200,
): { rows: T[]; shown: number; total: number; warning?: string } {
  const shown = Math.min(rows.length, limit);
  return {
    rows: rows.slice(0, limit),
    shown,
    total: rows.length,
    ...(rows.length > limit
      ? {
          warning:
            `Only ${shown} of ${rows.length} rows are here. Do not count from them — ` +
            "use the totals in this result, or narrow the search and ask again.",
        }
      : {}),
  };
}

/** How many rows fall into each value of a field — counted over everything. */
function countBy<T>(
  rows: T[],
  pick: (row: T) => string | null | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const key = pick(row);
    if (key) out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

const s = (v: unknown, fallback = "") => (v == null ? fallback : String(v).trim());
const n = (v: unknown, fallback = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
};

export const TOOLS: AssistantTool[] = [
  {
    name: "list_workers",
    description:
      "The people on the payroll. Use for questions about headcount, who works where, " +
      "who is on which site or group, and who is not yet enrolled on the scanner.",
    parameters: {
      type: "object",
      properties: {
        site: { type: "string", description: "Only this site, e.g. KB or KL." },
        group: { type: "string", description: "Only this group, e.g. B1." },
        status: { type: "string", description: "Only this status, e.g. active." },
        search: { type: "string", description: "Match a name, code or scanner number." },
      },
    },
  },
  {
    name: "get_month_pay",
    description:
      "The worked-out payroll for one month: basic days, overtime, rest day and public " +
      "holiday hours per worker, plus anything still to check before it can be exported. " +
      "Use for any question about a month's pay or overtime.",
    parameters: {
      type: "object",
      properties: {
        month: { type: "string", description: "The month, as 2026-09." },
      },
      required: ["month"],
    },
  },
  {
    name: "list_pay_items",
    description: "Allowances, advances and deductions recorded for a month.",
    parameters: {
      type: "object",
      properties: { month: { type: "string", description: "The month, as 2026-09." } },
    },
  },
  {
    name: "list_leave",
    description: "Leave records. Give a worker code to narrow it to one person.",
    parameters: {
      type: "object",
      properties: { code: { type: "string", description: "A worker's Million code." } },
    },
  },
  {
    name: "list_documents",
    description:
      "Passports, work permits, FOMEMA and insurance, with how long each has left. " +
      "Use for anything about permits expiring.",
    parameters: {
      type: "object",
      properties: {
        expiring_only: {
          type: "boolean",
          description: "Only those already expired or expiring within three months.",
        },
      },
    },
  },
  {
    name: "list_notes",
    description: "Warnings and notes kept against workers.",
    parameters: {
      type: "object",
      properties: { code: { type: "string", description: "A worker's Million code." } },
    },
  },
  {
    name: "list_assignments",
    description: "Who sleeps in which hostel room and rides which van.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "list_customers",
    description: "The customers we sell to. Use for anything about dealers or states.",
    parameters: {
      type: "object",
      properties: {
        state: { type: "string" },
        search: { type: "string", description: "Match a name or code." },
      },
    },
  },
  {
    name: "list_products",
    description: "The products we sell, with their cost and list price.",
    parameters: {
      type: "object",
      properties: {
        group: { type: "string" },
        search: { type: "string", description: "Match an item code or description." },
      },
    },
  },
  {
    name: "get_prices",
    description:
      "What a dealer currently pays for each product, with the margin over cost. " +
      "Use for questions about pricing, margin, or whether anything is sold below cost.",
    parameters: {
      type: "object",
      properties: {
        customer_code: { type: "string", description: "The debtor code, e.g. 3030/0003." },
      },
      required: ["customer_code"],
    },
  },
  {
    name: "list_orders",
    description: "Sales orders, newest first, with their value.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "list_holidays",
    description:
      "The company's public holidays, with the day of the week each falls on. Use for any " +
      "question about which days are holidays, how many there are in a month or a year, or " +
      "what a holiday is called.",
    parameters: {
      type: "object",
      properties: {
        year: { type: "string", description: "Only this year, as 2026. Leave out for all." },
      },
    },
  },

  /* ── the writing tools ─────────────────────────────────────────────────── */

  {
    name: "create_worker",
    description:
      "Add one person to the payroll. Only after the code, name, site and group are all " +
      "known — ask for anything missing rather than guessing it.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "The Million code, e.g. B76." },
        name: { type: "string" },
        site: { type: "string", description: "KB or KL, or another site already in use." },
        group: { type: "string", description: "B1 to B4, or another group already in use." },
        nationality: { type: "string" },
        scanner_id: { type: "string", description: "Their CheckTime number, if known." },
      },
      required: ["code", "name", "site", "group"],
    },
  },
  {
    name: "set_worker_status",
    description:
      "Change one worker's status — for instance marking somebody as left. Only statuses " +
      "that already exist may be used.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string" },
        status: { type: "string" },
      },
      required: ["code", "status"],
    },
  },
  {
    name: "add_pay_item",
    description:
      "Record one allowance, advance or deduction against a worker for a month.",
    parameters: {
      type: "object",
      properties: {
        month: { type: "string", description: "The month, as 2026-09." },
        code: { type: "string" },
        kind: { type: "string", description: "allowance, advance or deduction." },
        label: { type: "string", description: "What it is for — Levy, Hostel, Attendance." },
        amount: { type: "number" },
        note: { type: "string" },
      },
      required: ["month", "code", "kind", "amount"],
    },
  },
  {
    name: "record_leave",
    description: "Record leave for one worker.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string" },
        kind: { type: "string", description: "Annual, Medical, Hospital, Unpaid…" },
        from_date: { type: "string", description: "As 2026-09-10." },
        to_date: { type: "string", description: "As 2026-09-12." },
        paid: { type: "boolean" },
        note: { type: "string" },
      },
      required: ["code", "kind", "from_date", "to_date"],
    },
  },
  {
    name: "add_document",
    description: "Record a passport, work permit, FOMEMA or insurance, and when it expires.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string" },
        kind: { type: "string" },
        number: { type: "string" },
        expires_on: { type: "string", description: "As 2027-03-01." },
        issued_on: { type: "string" },
      },
      required: ["code", "kind"],
    },
  },
  {
    name: "add_note",
    description: "Record a warning or a note against a worker.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string" },
        kind: { type: "string", description: "Warning, Note or Praise." },
        on_date: { type: "string", description: "As 2026-09-05." },
        subject: { type: "string", description: "One line." },
        detail: { type: "string" },
      },
      required: ["code", "subject"],
    },
  },
  {
    name: "set_dealer_price",
    description:
      "Set what one dealer pays for one product, from a date. This never overwrites an " +
      "old price — orders already written keep the price they were sold at.",
    parameters: {
      type: "object",
      properties: {
        customer_code: { type: "string" },
        item_code: { type: "string" },
        price: { type: "number" },
        effective_from: { type: "string", description: "As 2026-09-05. Defaults to today." },
        note: { type: "string", description: "Why it changed." },
      },
      required: ["customer_code", "item_code", "price"],
    },
  },
  {
    name: "add_holiday",
    description:
      "Record one public holiday. Use it when the office reads out or pastes next year's " +
      "list — call it once for each day. Saving a date that already exists replaces it.",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "The day, as 2027-01-01." },
        name: { type: "string", description: "What it is called, e.g. Deepavali." },
        compulsory: {
          type: "boolean",
          description: "True if the company's own sheet marks it with ** as compulsory.",
        },
        note: {
          type: "string",
          description: "For instance, which Saturday this day replaces.",
        },
      },
      required: ["date", "name"],
    },
  },
  {
    name: "create_customer",
    description: "Add one customer.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "The Million debtor code, e.g. 3030/0400." },
        name: { type: "string" },
        short_name: { type: "string" },
        state: { type: "string" },
        contact: { type: "string" },
        email: { type: "string" },
      },
      required: ["code", "name"],
    },
  },
  {
    name: "create_product",
    description: "Add one product to the SKU list.",
    parameters: {
      type: "object",
      properties: {
        item_code: { type: "string" },
        description: { type: "string" },
        item_group: { type: "string" },
        uom: { type: "string" },
        pack_size: { type: "string" },
        cost: { type: "number" },
        base_price: { type: "number" },
      },
      required: ["item_code", "description"],
    },
  },
];

export const WRITING_TOOLS = new Set([
  "create_worker", "set_worker_status", "add_pay_item", "record_leave",
  "add_document", "add_note", "add_holiday", "set_dealer_price",
  "create_customer", "create_product",
]);

export async function runTool(name: string, input: Record<string, unknown>): Promise<ToolOutcome> {
  switch (name) {
    /* ── reading ─────────────────────────────────────────────────────────── */
    case "list_workers": {
      const all = await listWorkers();
      const q = s(input.search).toLowerCase();
      const rows = all.filter(
        (w) =>
          (!input.site || w.site === s(input.site)) &&
          (!input.group || w.group === s(input.group)) &&
          (!input.status || w.status === s(input.status)) &&
          (!q || `${w.code} ${w.name} ${w.scannerId}`.toLowerCase().includes(q)),
      );
      const statuses = await listStatuses();
      const working = new Set(statuses.filter((x) => x.countsAsWorking).map((x) => x.name));
      const active = rows.filter((w) => working.has(w.status));
      const unenrolled = active.filter((w) => !w.scannerId);
      return {
        result: {
          // Counted over every matching row, not only the ones listed below.
          totals: {
            matching: rows.length,
            working: active.length,
            withoutScannerNumber: unenrolled.length,
            withoutScannerNumberBySite: countBy(unenrolled, (w) => w.site),
            bySite: countBy(rows, (w) => w.site),
            byGroup: countBy(rows, (w) => w.group),
            byStatus: countBy(rows, (w) => w.status),
            byNationality: countBy(rows, (w) => w.nationality),
          },
          ...cap(rows),
        },
      };
    }

    case "get_month_pay": {
      const month = s(input.month);
      const [view, extras] = await Promise.all([loadMonthView(month), monthExtras(month)]);
      const flagCounts: Record<string, number> = {};
      for (const f of view.flags) flagCounts[f.kind] = (flagCounts[f.kind] ?? 0) + 1;
      return {
        result: {
          month,
          workers: view.totals.length,
          stillToCheck: view.flags.length,
          checkListBreakdown: flagCounts,
          canExport: view.flags.length === 0,
          totals: cap(
            view.totals.map((t) => ({
              ...t,
              allowance: extras.get(t.code)?.allowance ?? 0,
              advance: extras.get(t.code)?.advance ?? 0,
            })),
          ),
        },
      };
    }

    case "list_pay_items":
      return { result: cap(await listPayItems(s(input.month) || undefined)) };

    case "list_leave":
      return { result: cap(await listLeave(s(input.code) || undefined)) };

    case "list_documents": {
      const all = await listDocuments();
      const now = today();
      const withState = all.map((d) => ({
        ...d,
        state: expiryLevel(d.expiresOn, now),
        inWords: expiryWords(d.expiresOn, now),
      }));
      const rows = input.expiring_only
        ? withState.filter((d) => ["expired", "urgent", "soon"].includes(d.state))
        : withState;
      return {
        result: {
          totals: {
            matching: rows.length,
            byState: countBy(rows, (d) => d.state),
            byKind: countBy(rows, (d) => d.kind),
          },
          ...cap(rows),
        },
      };
    }

    case "list_notes":
      return { result: cap(await listNotes(s(input.code) || undefined)) };

    case "list_assignments":
      return { result: cap(await listAssignments()) };

    case "list_customers": {
      const all = await listCustomers();
      const q = s(input.search).toLowerCase();
      const rows = all.filter(
        (c) =>
          (!input.state || c.state === s(input.state)) &&
          (!q || `${c.code} ${c.name} ${c.shortName}`.toLowerCase().includes(q)),
      );
      return {
        result: {
          totals: {
            matching: rows.length,
            stillBuying: rows.filter((c) => c.active).length,
            byState: countBy(rows, (c) => c.state || "not recorded"),
          },
          ...cap(rows),
        },
      };
    }

    case "list_products": {
      const all = await listProducts();
      const q = s(input.search).toLowerCase();
      const rows = all.filter(
        (p) =>
          (!input.group || p.itemGroup === s(input.group)) &&
          (!q || `${p.itemCode} ${p.description}`.toLowerCase().includes(q)),
      );
      return {
        result: {
          totals: {
            matching: rows.length,
            stillSold: rows.filter((p) => p.active).length,
            byGroup: countBy(rows, (p) => p.itemGroup || "no group"),
            byUnit: countBy(rows, (p) => p.uom || "no unit"),
          },
          ...cap(rows),
        },
      };
    }

    case "get_prices": {
      const code = s(input.customer_code);
      const [prices, products, customers] = await Promise.all([
        listPrices(code), listProducts(), listCustomers(),
      ]);
      const list = currentListFor(code, prices, today());
      const byItem = new Map(products.map((p) => [p.itemCode, p]));
      const rows = [...list.values()].map((row) => {
        const item = byItem.get(row.itemCode);
        return {
          itemCode: row.itemCode,
          description: item?.description ?? "",
          price: row.price,
          cost: item?.cost ?? 0,
          margin: Math.round((row.price - (item?.cost ?? 0)) * 100) / 100,
          belowCost: row.price < (item?.cost ?? 0),
          from: row.effectiveFrom,
        };
      });
      return {
        result: {
          customer: customers.find((c) => c.code === code)?.name ?? code,
          priced: rows.length,
          belowCost: rows.filter((r) => r.belowCost).length,
          ...cap(rows),
        },
      };
    }

    case "list_holidays": {
      const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const all = await listHolidays(s(input.year) || undefined);
      const rows = all.map((h) => ({
        ...h,
        day: DAYS[new Date(`${h.onDate}T00:00:00`).getDay()],
      }));
      const byYear: Record<string, number> = {};
      for (const h of rows) {
        const y = h.onDate.slice(0, 4);
        byYear[y] = (byYear[y] ?? 0) + 1;
      }
      return {
        result: {
          totals: {
            matching: rows.length,
            compulsory: rows.filter((h) => h.compulsory).length,
            byYear,
          },
          ...cap(rows),
        },
      };
    }

    case "list_orders": {
      const orders = await listOrders();
      return {
        result: cap(
          orders.map((o) => ({
            ...o,
            value: Math.round(o.lines.reduce((t, l) => t + l.qty * l.price, 0) * 100) / 100,
          })),
        ),
      };
    }

    /* ── writing ─────────────────────────────────────────────────────────── */
    case "create_worker": {
      const code = s(input.code).toUpperCase();
      const existing = (await listWorkers()).find((w) => w.code === code);
      if (existing) {
        return { result: { refused: `${code} already exists — that is ${existing.name}.` } };
      }
      const worker = {
        code,
        name: s(input.name),
        site: s(input.site),
        group: s(input.group),
        nationality: s(input.nationality) || null,
        scannerId: s(input.scanner_id),
        status: "active",
      };
      await upsertWorker(worker);
      return { result: { saved: worker }, changed: `Added worker ${code} — ${worker.name}` };
    }

    case "set_worker_status": {
      const code = s(input.code).toUpperCase();
      const status = s(input.status);
      const [workers, statuses] = await Promise.all([listWorkers(), listStatuses()]);
      const worker = workers.find((w) => w.code === code);
      if (!worker) return { result: { refused: `No worker with the code ${code}.` } };
      if (!statuses.some((x) => x.name === status)) {
        return {
          result: {
            refused:
              `"${status}" is not a status that exists. The ones in use are: ` +
              statuses.map((x) => x.name).join(", ") +
              ". A new status has to be added on the Workers screen, because it decides who gets paid.",
          },
        };
      }
      await upsertWorker({ ...worker, status });
      return {
        result: { saved: { code, status } },
        changed: `${worker.name} (${code}) is now "${status}"`,
      };
    }

    case "add_pay_item": {
      const code = s(input.code).toUpperCase();
      await savePayItem({
        monthKey: s(input.month),
        code,
        kind: s(input.kind, "allowance"),
        label: s(input.label),
        amount: n(input.amount),
        note: s(input.note) || null,
      });
      const kind = s(input.kind, "allowance");
      return {
        result: { saved: true },
        changed:
          `${kind === "allowance" ? "Allowance" : "Deduction"} of RM${n(input.amount).toFixed(2)} ` +
          `for ${code} in ${s(input.month)}${s(input.label) ? ` (${s(input.label)})` : ""}`,
      };
    }

    case "record_leave": {
      const code = s(input.code).toUpperCase();
      const from = s(input.from_date);
      const to = s(input.to_date) || from;
      const days =
        Math.round((Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / 86_400_000) + 1;
      await saveLeave({
        code,
        kind: s(input.kind, "Annual"),
        fromDate: from,
        toDate: to,
        days: days > 0 ? days : 1,
        paid: input.paid !== false,
        note: s(input.note) || null,
      });
      return {
        result: { saved: true, days },
        changed: `${s(input.kind, "Annual")} leave for ${code}, ${from} to ${to}`,
      };
    }

    case "add_document": {
      const code = s(input.code).toUpperCase();
      await saveDocument({
        code,
        kind: s(input.kind),
        number: s(input.number) || null,
        issuedOn: s(input.issued_on) || null,
        expiresOn: s(input.expires_on) || null,
        note: null,
      });
      return {
        result: { saved: true },
        changed:
          `${s(input.kind)} recorded for ${code}` +
          (s(input.expires_on) ? `, expiring ${s(input.expires_on)}` : ""),
      };
    }

    case "add_note": {
      const code = s(input.code).toUpperCase();
      await saveNote({
        code,
        kind: s(input.kind, "Note"),
        onDate: s(input.on_date) || today(),
        subject: s(input.subject),
        detail: s(input.detail) || null,
      });
      return {
        result: { saved: true },
        changed: `${s(input.kind, "Note")} recorded for ${code}: ${s(input.subject)}`,
      };
    }

    case "set_dealer_price": {
      const customerCode = s(input.customer_code);
      const itemCode = s(input.item_code).toUpperCase();
      const price = n(input.price, -1);
      if (price < 0) return { result: { refused: "A price cannot be less than nothing." } };

      const [customers, products] = await Promise.all([listCustomers(), listProducts()]);
      if (!customers.some((c) => c.code === customerCode)) {
        return { result: { refused: `No customer with the code ${customerCode}.` } };
      }
      const item = products.find((p) => p.itemCode === itemCode);
      if (!item) return { result: { refused: `No product with the code ${itemCode}.` } };

      const from = s(input.effective_from) || today();
      await setPrice({ customerCode, itemCode, price, effectiveFrom: from, note: s(input.note) || null });
      return {
        result: {
          saved: true,
          cost: item.cost,
          margin: Math.round((price - item.cost) * 100) / 100,
          belowCost: price < item.cost,
        },
        changed: `${itemCode} priced at RM${price.toFixed(2)} for ${customerCode}, from ${from}`,
      };
    }

    case "add_holiday": {
      const date = s(input.date);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return { result: { refused: `"${date}" is not a date. Give it as 2027-01-01.` } };
      }
      const name = s(input.name);
      if (!name) return { result: { refused: "A holiday needs a name." } };

      const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const day = DAYS[new Date(`${date}T00:00:00`).getDay()];
      await saveHoliday({
        onDate: date,
        name,
        compulsory: input.compulsory === true,
        note: s(input.note) || null,
      });
      return {
        result: {
          saved: true,
          day,
          // Saturday is already a rest day, so a holiday landing on one earns
          // nobody an extra day — worth saying rather than silently accepting.
          warning:
            day === "Saturday"
              ? "That is a Saturday, which is already a rest day. If the company observes " +
                "another day instead, record that day too."
              : undefined,
        },
        changed: `${name} recorded as a holiday on ${date} (${day})`,
      };
    }

    case "create_customer": {
      const code = s(input.code);
      const name = s(input.name);
      if ((await listCustomers()).some((c) => c.code === code)) {
        return { result: { refused: `${code} already exists.` } };
      }
      await upsertCustomer({
        code, name,
        shortName: s(input.short_name) || name,
        state: s(input.state),
        address: null,
        contact: s(input.contact) || null,
        email: s(input.email) || null,
        attn: null,
        incomeTaxNo: null,
        active: true,
      });
      return { result: { saved: true }, changed: `Added customer ${code} — ${name}` };
    }

    case "create_product": {
      const itemCode = s(input.item_code).toUpperCase();
      if ((await listProducts()).some((p) => p.itemCode === itemCode)) {
        return { result: { refused: `${itemCode} already exists.` } };
      }
      await upsertProduct({
        itemCode,
        description: s(input.description),
        barcode: null,
        itemGroup: s(input.item_group),
        itemType: "",
        uom: s(input.uom),
        packSize: s(input.pack_size),
        basePrice: n(input.base_price),
        cost: n(input.cost),
        active: true,
      });
      return {
        result: { saved: true },
        changed: `Added product ${itemCode} — ${s(input.description)}`,
      };
    }

    default:
      return { result: { refused: `There is no tool called ${name}.` } };
  }
}
