// Reads a customer's own order and reports what it says.
//
// The model reads; this route resolves. Nothing it returns is put on a sheet
// without somebody looking at it — see order-reader.ts for why that split is
// where it is.
import OpenAI from "openai";
import {
  listAliases, listCustomers, listOutletAliases, listProducts, outletsOf,
} from "@/lib/store-sales";
import {
  READER_SYSTEM, catalogueFor, matchReading, outletsFor, parseReading, readingProblems,
} from "@/lib/order-reader";
import { DEFAULT_MODEL, isKnownModel } from "@/lib/assistant-models";
import { guard, problem, readBody, str } from "@/lib/route-helpers";

export const runtime = "nodejs";
export const maxDuration = 120;

/** A photographed order is a big string; anything past this is not an order. */
const MAX_IMAGE_CHARS = 8_000_000;
const MAX_TEXT_CHARS = 40_000;

export async function POST(request: Request) {
  const stop = await guard();
  if (stop) return stop;

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return problem("The reader is not set up: OPENAI_API_KEY is missing on the server.");
  }

  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");

  const text = str(b.text).slice(0, MAX_TEXT_CHARS);
  const image = str(b.image);
  const groupCode = str(b.groupCode);
  const customerCode = str(b.customerCode);
  const model = isKnownModel(str(b.model)) ? str(b.model) : DEFAULT_MODEL;

  if (!text && !image) return problem("Paste the order, or choose a photograph of it.");
  if (image.length > MAX_IMAGE_CHARS) {
    return problem("That picture is too large. Photograph the order again at a smaller size.");
  }
  if (image && !image.startsWith("data:image/")) {
    return problem("That file is not a picture. A photograph or a screenshot works best.");
  }

  try {
    const [products, aliases, outletAliases] = await Promise.all([
      listProducts(), listAliases(), listOutletAliases(),
    ]);
    const outlets = groupCode
      ? await outletsOf(groupCode)
      : (await listCustomers()).filter((c) => c.code === customerCode);

    const catalogue = catalogueFor(products, aliases);
    const context = [
      outlets.length > 1
        ? `The outlets this customer orders for:\n${JSON.stringify(outletsFor(outlets))}`
        : "This order is for a single shop. Leave outletText empty.",
      `Products we sell, for reading unclear text only — never substitute a different one:`,
      JSON.stringify(catalogue),
    ].join("\n\n");

    const client = new OpenAI({ apiKey: key });
    const content: OpenAI.Chat.ChatCompletionContentPart[] = [];
    if (text) content.push({ type: "text", text: `The customer's order:\n\n${text}` });
    if (image) {
      content.push({ type: "text", text: "The customer's order is in this picture." });
      content.push({ type: "image_url", image_url: { url: image } });
    }

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: `${READER_SYSTEM}\n\n${context}` },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const read = parseReading(raw);
    if (!read) {
      return problem(
        "The order could not be read. Try a clearer photograph, or paste the order as text.",
      );
    }

    const reading = matchReading(read, products, aliases, outlets, outletAliases);
    return Response.json({
      ok: true,
      value: {
        reading,
        problems: readingProblems(reading, outlets.length),
        outlets: outletsFor(outlets),
        model,
      },
    });
  } catch (e) {
    return problem(`The reader could not finish: ${(e as Error).message}`);
  }
}
