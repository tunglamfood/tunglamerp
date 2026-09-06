// The admin assistant.
//
// A hand-written tool loop rather than a framework, because the office needs to
// see afterwards exactly what was changed on their behalf — every writing tool
// reports a line, and those lines come back with the answer.
//
// No temperature, top_p or any other sampling setting is sent. The model's own
// defaults are left alone on purpose.
import OpenAI from "openai";
import { requireSession } from "@/lib/supabase-server";
import { TOOLS, runTool } from "@/lib/assistant-tools";
import { DEFAULT_MODEL, MODELS, isKnownModel } from "@/lib/assistant-models";
import { addMessages, createSession, titleFrom } from "@/lib/store-assistant";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Enough turns for look-then-act, not enough to wander. */
const MAX_TURNS = 12;

const SYSTEM = `You are the assistant inside TungLam ERP, the system Tung Lam Food
Industries uses to run its factory. You help the office staff — who are not
technical — with two things: answering questions about the business from its own
data, and doing small pieces of admin for them.

The system holds:
- HR: about 85 workers, their attendance from a CheckTime face scanner, the
  monthly overtime calculation, allowances and advances, leave, work permits and
  passports, hostel and transport, and warnings.
- Sales: about 322 customers, 346 products, and what each dealer pays for each
  product. The same product costs a different price to every dealer.

How to answer:
- Look before you speak. If a question touches the business, read the data with a
  tool rather than guessing. Never invent a number.
- Write the way you would speak to a smart person who is not technical. No jargon.
  Malaysian ringgit is RM. Say "worker", not "employee record".
- Be brief. A number and a sentence beats a paragraph. Use a short table when
  comparing several things.
- When something looks wrong — a price below cost, a permit about to expire, a
  worker with no scanner number — say so plainly, even if it was not asked.
- Some costs in this system were brought in per carton while prices are per
  packet. If a cost is many times the price, say the cost looks mis-keyed rather
  than calling it a loss.

Before you change anything:
- Only write when the person has clearly asked you to. A question is not an
  instruction.
- If a required detail is missing, ask for it. Do not guess a worker's code, a
  site, a group, or an amount.
- After writing, say exactly what you did in one line.

Answers are shown as Markdown, so **bold**, tables and lists all render. Use a
table whenever you are laying out figures.

When somebody wants something printed or downloaded — a payslip, a report, a
copy to send — do not draw a blank template for them to fill in. Point them at
the report page, which builds it from the real figures and prints or saves as a
PDF, and can be downloaded as a spreadsheet:

- All payslips for a month: [Payslips](/reports/payslips?month=YYYY-MM)
- One worker: [Payslip](/reports/payslips?month=YYYY-MM&code=B08)

Write those as Markdown links with the month filled in. Say in one line what
they will find there.

What you cannot do: delete anything, change many records at once, or run the
payroll export. Those stay with the office. If asked, say so and explain where on
the screen they can do it themselves.

Today is ${new Date().toISOString().slice(0, 10)}.`;

interface Turn {
  role: "user" | "assistant";
  content: string;
}

const asFunctions = () =>
  TOOLS.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

/** Turns an SDK failure into something the office can act on. */
function explain(e: unknown): { message: string; status: number } {
  if (e instanceof OpenAI.AuthenticationError) {
    return {
      message: "The OpenAI key in app/.env.local is not being accepted.",
      status: 502,
    };
  }
  if (e instanceof OpenAI.RateLimitError) {
    return { message: "Too many questions at once. Wait a moment and ask again.", status: 429 };
  }
  if (e instanceof OpenAI.NotFoundError) {
    return {
      message:
        "That model is not available on this OpenAI account. Pick the other one, or check " +
        "which models the key allows.",
      status: 400,
    };
  }
  if (e instanceof OpenAI.APIError) {
    return { message: `The assistant could not answer: ${e.message}`, status: 502 };
  }
  return { message: `The assistant could not answer: ${(e as Error).message}`, status: 502 };
}

export async function POST(request: Request) {
  if (!(await requireSession())) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return Response.json(
      {
        error:
          "The assistant is not switched on yet. It needs an OpenAI key: add a line " +
          "OPENAI_API_KEY=… to app/.env.local and restart.",
      },
      { status: 503 },
    );
  }

  let body: { messages?: Turn[]; model?: string; sessionId?: number };
  try {
    body = (await request.json()) as {
      messages?: Turn[];
      model?: string;
      sessionId?: number;
    };
  } catch {
    return Response.json({ error: "Could not read what was sent." }, { status: 400 });
  }

  const model = body.model && isKnownModel(body.model) ? body.model : DEFAULT_MODEL;
  const history = (body.messages ?? []).slice(-20);
  if (history.length === 0) {
    return Response.json({ error: "Ask a question first." }, { status: 400 });
  }

  const client = new OpenAI({ apiKey: key });
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM },
    ...history.map((m) => ({ role: m.role, content: m.content }) as OpenAI.Chat.ChatCompletionMessageParam),
  ];

  const changed: string[] = [];
  const used: string[] = [];
  const asked = history[history.length - 1]?.content ?? "";

  /**
   * Saves the exchange and hands back the conversation it belongs to. A
   * failure to save must not swallow the answer — the office would rather have
   * the reply and lose the record than lose both.
   */
  async function keep(reply: string): Promise<{ sessionId: number | null; saved: boolean }> {
    try {
      const sessionId = body.sessionId ?? (await createSession(titleFrom(asked), model));
      await addMessages(sessionId, [
        { role: "user", content: asked, changed: [], toolsUsed: [], model },
        { role: "assistant", content: reply, changed, toolsUsed: used, model },
      ]);
      return { sessionId, saved: true };
    } catch {
      return { sessionId: body.sessionId ?? null, saved: false };
    }
  }

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const response = await client.chat.completions.create({
        model,
        messages,
        tools: asFunctions(),
      });

      const choice = response.choices[0];
      const message = choice?.message;
      if (!message) {
        const reply = "I could not find anything to say about that.";
        return Response.json({ reply, changed, used, model, ...(await keep(reply)) });
      }

      const calls = message.tool_calls ?? [];
      if (calls.length === 0) {
        const reply =
          (message.content ?? "").trim() || "I could not find anything to say about that.";
        return Response.json({ reply, changed, used, model, ...(await keep(reply)) });
      }

      messages.push(message);

      for (const call of calls) {
        if (call.type !== "function") continue;
        used.push(call.function.name);

        let input: Record<string, unknown> = {};
        try {
          // Never string-match the arguments — they are JSON and can be escaped
          // in ways that look surprising.
          input = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: "Those arguments were not readable. Send them again as plain JSON.",
          });
          continue;
        }

        try {
          const outcome = await runTool(call.function.name, input);
          if (outcome.changed) changed.push(outcome.changed);
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(outcome.result),
          });
        } catch (e) {
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: `That did not work: ${(e as Error).message}`,
          });
        }
      }
    }

    const reply =
      "That turned into more steps than I can take in one go. Try asking for a " +
      "smaller piece of it.";
    return Response.json({ reply, changed, used, model, ...(await keep(reply)) });
  } catch (e) {
    const { message, status } = explain(e);
    return Response.json({ error: message, changed }, { status });
  }
}

/**
 * What the screen needs before anyone types: whether the assistant is switched
 * on, and which models it may be pointed at.
 *
 * This used to ask OpenAI to list every model on the account so the picker
 * could mark one unavailable. That cost a second of waiting on every single
 * open, to answer a question that does not change — and if a model ever does
 * stop working, the error already says so in words. Nothing here leaves the
 * server now, so the picker is there on the first paint.
 */
export async function GET() {
  if (!(await requireSession())) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }
  return Response.json({
    ready: !!process.env.OPENAI_API_KEY,
    default: DEFAULT_MODEL,
    models: MODELS,
  });
}
