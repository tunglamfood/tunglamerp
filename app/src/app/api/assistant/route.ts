// The admin assistant.
//
// A manual tool loop rather than the SDK's tool runner, because the office
// needs to see afterwards exactly what was changed on their behalf — every
// writing tool reports a line, and those lines come back with the answer.
import Anthropic from "@anthropic-ai/sdk";
import { requireSession } from "@/lib/supabase-server";
import { TOOLS, runTool } from "@/lib/assistant-tools";

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

export async function POST(request: Request) {
  if (!(await requireSession())) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return Response.json(
      {
        error:
          "The assistant is not switched on yet. It needs an Anthropic API key: " +
          "get one at console.anthropic.com, then add a line ANTHROPIC_API_KEY=… " +
          "to app/.env.local and restart.",
      },
      { status: 503 },
    );
  }

  let body: { messages?: Turn[] };
  try {
    body = (await request.json()) as { messages?: Turn[] };
  } catch {
    return Response.json({ error: "Could not read what was sent." }, { status: 400 });
  }

  const history = (body.messages ?? []).slice(-20);
  if (history.length === 0) {
    return Response.json({ error: "Ask a question first." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: key });
  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const changed: string[] = [];
  const used: string[] = [];

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const response = await client.messages.create({
        model: "claude-opus-5",
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        system: SYSTEM,
        tools: TOOLS,
        messages,
      });

      if (response.stop_reason === "refusal") {
        return Response.json({
          reply:
            "I am not able to answer that one. If it was about the factory's own data, " +
            "try asking it a different way.",
          changed,
          used,
        });
      }

      const calls = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      if (calls.length === 0) {
        const reply = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        return Response.json({
          reply: reply || "I could not find anything to say about that.",
          changed,
          used,
        });
      }

      // Every tool_result for one assistant turn goes back in one user message.
      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.ToolResultBlockParam[] = [];

      for (const call of calls) {
        used.push(call.name);
        try {
          const outcome = await runTool(call.name, call.input as Record<string, unknown>);
          if (outcome.changed) changed.push(outcome.changed);
          results.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: JSON.stringify(outcome.result),
          });
        } catch (e) {
          results.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: `That did not work: ${(e as Error).message}`,
            is_error: true,
          });
        }
      }

      messages.push({ role: "user", content: results });
    }

    return Response.json({
      reply:
        "That turned into more steps than I can take in one go. Try asking for a " +
        "smaller piece of it.",
      changed,
      used,
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return Response.json(
        { error: "The Anthropic API key in app/.env.local is not being accepted." },
        { status: 502 },
      );
    }
    if (e instanceof Anthropic.RateLimitError) {
      return Response.json(
        { error: "Too many questions at once. Wait a moment and ask again." },
        { status: 429 },
      );
    }
    return Response.json(
      { error: `The assistant could not answer: ${(e as Error).message}`, changed },
      { status: 502 },
    );
  }
}

/** Lets the screen show the assistant as available or not before anyone types. */
export async function GET() {
  if (!(await requireSession())) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }
  return Response.json({ ready: !!process.env.ANTHROPIC_API_KEY });
}

