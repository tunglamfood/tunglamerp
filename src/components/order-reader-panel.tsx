"use client";
// Paste or photograph a customer's own order, and get our sheet back.
//
// Every line lands here for a person to look at before it reaches the sheet.
// The model reads the order; it does not decide what gets picked. A line it
// could not settle arrives blank and stays blank until somebody fills it, and
// the text the customer actually wrote is always shown beside our guess, so the
// check is possible without going back to the original.
import { useState } from "react";
import { Btn, Chip, Drawer, FilePicker, Notice, Select } from "@/components/ui";
import { MatchedLine, isSellable } from "@/lib/order-reader";
import { Product } from "@/lib/types";

interface Outlet { code: string; name: string }

export function OrderReaderPanel({
  open, onClose, groupCode, outlets, products, labels, onAccept,
}: {
  open: boolean;
  onClose: () => void;
  groupCode: string;
  outlets: Outlet[];
  products: Product[];
  labels: Record<string, string>;
  /** Handed the settled lines, to be merged into the sheet. */
  onAccept: (lines: { itemCode: string; outletCode: string; qty: number }[], deliverOn: string | null) => void;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [lines, setLines] = useState<MatchedLine[] | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [deliverOn, setDeliverOn] = useState<string | null>(null);

  const itemOptions = products
    .filter(isSellable)
    .map((p) => ({
      value: p.itemCode,
      label: labels[p.itemCode] ? `${labels[p.itemCode]} — ${p.description}` : p.description,
      note: p.itemCode,
    }));

  const outletOptions = outlets.map((o) => ({ value: o.code, label: o.name }));

  function reset() {
    setText("");
    setFile(null);
    setLines(null);
    setProblems([]);
    setProblem(null);
    setDeliverOn(null);
  }

  async function read() {
    setBusy(true);
    setProblem(null);
    try {
      let image = "";
      if (file) image = await asDataUrl(file);
      const res = await fetch("/api/sales/read-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupCode, text, image }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "The order could not be read.");
      setLines(body.value.reading.lines);
      setProblems(body.value.problems ?? []);
      setDeliverOn(body.value.reading.deliverOn ?? null);
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function setLine(i: number, patch: Partial<MatchedLine>) {
    setLines((all) => (all ? all.map((l, x) => (x === i ? { ...l, ...patch } : l)) : all));
  }

  const settled = (lines ?? []).filter(
    (l) => l.itemCode && (outlets.length <= 1 || l.outletCode),
  );
  const unsettled = (lines ?? []).length - settled.length;

  function accept() {
    onAccept(
      settled.map((l) => ({
        itemCode: l.itemCode!,
        outletCode: l.outletCode ?? (outlets[0]?.code ?? ""),
        qty: l.qty,
      })),
      deliverOn,
    );
    reset();
    onClose();
  }

  return (
    <Drawer
      open={open}
      title="Read a customer order"
      sub="Paste it, or use a photograph. Nothing reaches the sheet until you say so."
      onClose={() => { reset(); onClose(); }}
      footer={
        lines ? (
          <div className="flex flex-wrap items-center gap-2">
            <Btn onClick={accept} disabled={settled.length === 0}>
              Put {settled.length} {settled.length === 1 ? "line" : "lines"} on the sheet
            </Btn>
            <Btn kind="ghost" onClick={() => setLines(null)}>Read something else</Btn>
            {unsettled > 0 && (
              <span className="text-[12px] font-semibold text-warn">
                {unsettled} still to settle — {unsettled === 1 ? "it" : "they"} will be left out
              </span>
            )}
          </div>
        ) : (
          <Btn onClick={() => void read()} disabled={busy || (!text.trim() && !file)}>
            {busy ? "Reading…" : "Read it"}
          </Btn>
        )
      }
    >
      {problem && <div className="mb-4"><Notice tone="bad">{problem}</Notice></div>}

      {!lines && (
        <div className="space-y-5">
          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-faint">
              Paste the order
            </div>
            <textarea
              className="h-44 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm placeholder:text-faint focus:border-accent"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"A WhatsApp message, an email, a table copied out of their spreadsheet —\nwhatever shape it arrives in."}
            />
          </div>

          <FilePicker
            label="Or a photograph of it"
            hint="A picture of the order book or their printed form. Keep the whole page in frame."
            accept="image/*"
            file={file}
            onPick={setFile}
          />

          <Notice tone="info">
            Every line comes back for you to check before anything is added. Anything that
            cannot be matched to a product is left blank rather than guessed.
          </Notice>
        </div>
      )}

      {lines && (
        <div className="space-y-4">
          {problems.map((p) => <Notice key={p} tone="warn">{p}</Notice>)}
          {problems.length === 0 && (
            <Notice tone="good">Every line matched a product. Still worth a glance.</Notice>
          )}

          {deliverOn && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-mute">The order says delivery on</span>
              <Chip tone="teal">{deliverOn}</Chip>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-gray-50/70 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                  <th className="px-3 py-2.5">As they wrote it</th>
                  <th className="px-3 py-2.5">Our product</th>
                  {outlets.length > 1 && <th className="px-3 py-2.5">Outlet</th>}
                  <th className="px-3 py-2.5 text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr
                    key={i}
                    className={`border-b border-line last:border-0 ${
                      l.itemCode ? "" : "bg-warn-soft/50"
                    }`}
                  >
                    <td className="px-3 py-2 align-middle">
                      <div className="font-semibold">{l.itemText}</div>
                      {l.outletText && (
                        <div className="text-[11px] text-mute">{l.outletText}</div>
                      )}
                    </td>
                    <td className="min-w-[240px] px-3 py-2">
                      <Select
                        value={l.itemCode ?? ""}
                        onChange={(v) => setLine(i, { itemCode: v, how: "code" })}
                        searchable
                        placeholder="Not matched — choose"
                        options={itemOptions}
                      />
                      {l.how === "name" && l.itemCode && (
                        <div className="mt-1 text-[11px] text-warn">matched on the name</div>
                      )}
                    </td>
                    {outlets.length > 1 && (
                      <td className="min-w-[190px] px-3 py-2">
                        <Select
                          value={l.outletCode ?? ""}
                          onChange={(v) => setLine(i, { outletCode: v })}
                          searchable
                          placeholder="Which outlet?"
                          options={outletOptions}
                        />
                      </td>
                    )}
                    <td className="nums px-3 py-2 text-right align-middle font-extrabold">
                      {l.qty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Drawer>
  );
}

/** The picture as a data URL, which is what the reader takes. */
function asDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("That picture could not be opened."));
    r.readAsDataURL(file);
  });
}
