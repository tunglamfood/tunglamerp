"use client";
import { Chip, Field, inputCls } from "@/components/ui";
import { Column, RecordScreen } from "@/components/record-screen";
import { post, remove } from "@/lib/api";
import { Holiday } from "@/lib/store-holidays";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dayOf = (iso: string) => DAYS[new Date(`${iso}T00:00:00`).getDay()];

/**
 * The holidays decide who is paid for a day nobody worked, so the office should
 * be able to see them and change them without asking anybody.
 */
export function HolidaysScreen({ holidays }: { holidays: Holiday[] }) {
  const years = [...new Set(holidays.map((h) => h.onDate.slice(0, 4)))].sort().reverse();

  const columns: Column<Holiday>[] = [
    { key: "date", head: "Date", cell: (h) => <span className="nums font-semibold">{h.onDate}</span> },
    { key: "day", head: "Day", cell: (h) => {
      const day = dayOf(h.onDate);
      return (
        <span className={day === "Saturday" ? "text-warn" : "text-mute"}>
          {day}
          {day === "Saturday" && " — already a rest day"}
        </span>
      );
    } },
    { key: "name", head: "Holiday", cell: (h) => <span className="font-medium">{h.name}</span> },
    { key: "compulsory", head: "", cell: (h) => (h.compulsory ? <Chip tone="blue">Compulsory</Chip> : null) },
    { key: "note", head: "Note", cell: (h) => <span className="text-mute">{h.note ?? ""}</span> },
  ];

  return (
    <RecordScreen<Holiday>
      title="Public holidays"
      sub={
        <span className="nums">
          {holidays.length} days · {holidays.filter((h) => h.compulsory).length} compulsory
        </span>
      }
      rows={holidays}
      columns={columns}
      searchIn={(h) => `${h.onDate} ${h.name} ${h.note ?? ""}`}
      empty="No holidays recorded. Add them and every month will count them."
      addLabel="Add a holiday"
      filters={
        years.length > 1
          ? [
              {
                key: "year",
                width: "w-[120px]",
                options: [
                  { value: "all", label: "All years" },
                  ...years.map((y) => ({
                    value: y,
                    label: y,
                    note: String(holidays.filter((h) => h.onDate.startsWith(y)).length),
                  })),
                ],
                match: (row, v) => (row as Holiday).onDate.startsWith(v),
              },
            ]
          : []
      }
      newRow={() => ({
        onDate: new Date().toISOString().slice(0, 10),
        name: "",
        compulsory: false,
        note: null,
      })}
      editTitle={(h, isNew) => (isNew ? "Add a holiday" : h.name || h.onDate)}
      editSub={(h) => (h.onDate ? `${dayOf(h.onDate)}, ${h.onDate}` : "")}
      canSave={(h) => (!h.onDate ? "Choose a date" : !h.name ? "Give it a name" : null)}
      onSave={(h) => post("/api/hr/holidays", h)}
      onDelete={(h) => remove(`/api/hr/holidays?date=${h.onDate}`)}
      form={(h, set) => (
        <>
          <Field
            label="Date"
            hint={
              h.onDate
                ? dayOf(h.onDate) === "Saturday"
                  ? "That is a Saturday, already a rest day. If the company observes another day instead, record that day here."
                  : `That is a ${dayOf(h.onDate)}.`
                : undefined
            }
          >
            <input type="date" className={`${inputCls} nums`} value={h.onDate}
              onChange={(e) => set({ ...h, onDate: e.target.value })} />
          </Field>
          <Field label="What it is called">
            <input className={inputCls} value={h.name} placeholder="Deepavali"
              onChange={(e) => set({ ...h, name: e.target.value })} />
          </Field>
          <Field label="Compulsory?" hint="Marked ** on the company's own sheet. Recorded for the record; it does not change the calculation.">
            <div className="flex gap-2">
              <button type="button" onClick={() => set({ ...h, compulsory: true })}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  h.compulsory ? "bg-accent text-white" : "border border-line bg-white text-mute"}`}>
                Compulsory
              </button>
              <button type="button" onClick={() => set({ ...h, compulsory: false })}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  !h.compulsory ? "bg-accent text-white" : "border border-line bg-white text-mute"}`}>
                Company holiday
              </button>
            </div>
          </Field>
          <Field label="Note" hint="For instance, which Saturday this replaces.">
            <input className={inputCls} value={h.note ?? ""} placeholder="Replaces Saturday 21 March"
              onChange={(e) => set({ ...h, note: e.target.value || null })} />
          </Field>
        </>
      )}
    />
  );
}
