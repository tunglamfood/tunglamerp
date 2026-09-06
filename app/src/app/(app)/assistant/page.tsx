// The assistant's own page: past conversations down the side, the current one
// beside it. The floating Ask button is a shortcut to the same thing.
import { listSessions } from "@/lib/store-assistant";
import { AssistantPage } from "@/components/assistant-page";
import { Notice } from "@/components/ui";
import { DEFAULT_MODEL, MODELS } from "@/lib/assistant-models";

export const dynamic = "force-dynamic";

export default async function Page() {
  let sessions: Awaited<ReturnType<typeof listSessions>> = [];
  let problem: string | null = null;
  try {
    sessions = await listSessions();
  } catch (e) {
    problem = (e as Error).message;
  }

  if (problem) {
    return (
      <Notice tone="bad">
        Could not reach the saved conversations. {problem}
      </Notice>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  // Known here already, so the model bar is complete on the first paint
  // rather than filling in a moment later.
  return (
    <AssistantPage
      initialSessions={sessions}
      today={today}
      models={MODELS}
      defaultModel={DEFAULT_MODEL}
      ready={!!process.env.OPENAI_API_KEY}
    />
  );
}
