// Which models the assistant may be asked to use.
//
// Kept in one place so the list can be changed without touching anything else.
// No temperature, top_p or any other sampling setting is sent anywhere — the
// model's own defaults are left alone deliberately.

export interface AssistantModel {
  /** Exactly what goes to the API. */
  id: string;
  /** What the office sees in the picker. */
  label: string;
  hint: string;
}

export const MODELS: AssistantModel[] = [
  {
    id: "gpt-5.4-mini",
    label: "5.4 mini",
    hint: "Quicker and cheaper. The default, and enough for most questions.",
  },
  {
    id: "gpt-5.2",
    label: "5.2",
    hint: "Slower and dearer. Worth it for a question that needs more thought.",
  },
];

export const DEFAULT_MODEL = MODELS[0].id;

export function isKnownModel(id: string): boolean {
  return MODELS.some((m) => m.id === id);
}
