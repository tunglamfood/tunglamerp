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

  let body: { messages?: Turn[]; model?: string };
  try {
    body = (await request.json()) as { messages?: Turn[]; model?: string };
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
        return Response.json({ reply: "I could not find anything to say about that.", changed, used });
      }

      const calls = message.tool_calls ?? [];
      if (calls.length === 0) {
        return Response.json({
          reply: (message.content ?? "").trim() || "I could not find anything to say about that.",
          changed,
          used,
          model,
        });
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

    return Response.json({
      reply:
        "That turned into more steps than I can take in one go. Try asking for a " +
        "smaller piece of it.",
      changed,
      used,
      model,
    });
  } catch (e) {
    const { message, status } = explain(e);
    return Response.json({ error: message, changed }, { status });
  }
}

/**
 * What the screen needs before anyone types: whether the assistant is switched
 * on, and which models it may be pointed at. Where the key allows it, the list
 * is checked against the account so the picker cannot offer something that will
 * fail — but a failure to check is not a reason to hide the picker.
 */
export async function GET() {
  if (!(await requireSession())) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return Response.json({ ready: false, models: MODELS, default: DEFAULT_MODEL });
  }

  let available: string[] | null = null;
  try {
    const list = await new OpenAI({ apiKey: key }).models.list();
    available = list.data.map((m) => m.id);
  } catch {
    available = null; // Could not ask; offer everything rather than nothing.
  }

  return Response.json({
    ready: true,
    default: DEFAULT_MODEL,
    models: MODELS.map((m) => ({
      ...m,
      available: available == null ? null : available.includes(m.id),
    })),
  });
}
