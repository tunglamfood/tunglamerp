// A blank allowance & advance sheet, with every active worker's code and name
// already in it. The office only has to type the amounts — no chance of a
// mistyped code, which is the one thing that would silently drop a worker.
import { requireSession } from "@/lib/supabase-server";
import { listWorkers } from "@/lib/store";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

export async function GET() {
  if (!(await requireSession())) return new Response("Please sign in.", { status: 401 });

  let rows: (string | number)[][];
  try {
    const workers = (await listWorkers()).filter((w) => w.status === "active");
    rows = [
      ["CODE", "NAME", "ALLOWANCE", "ADVANCE"],
      ...workers.map((w) => [w.code, w.name, 0, 0]),
    ];
  } catch {
    // Even with no worker list, hand back the shape so the office can see it.
    rows = [["CODE", "NAME", "ALLOWANCE", "ADVANCE"], ["B08", "Example worker", 0, 0]];
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 10 }, { wch: 30 }, { wch: 12 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Allowance & advance");
  const file = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="ALLOWANCE_ADVANCE_TEMPLATE.xlsx"',
    },
  });
}
