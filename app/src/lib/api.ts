// One way of talking to our own API from a screen, so every page reports a
// failure to the office in the same words.
export async function post(url: string, body: unknown): Promise<{ error?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error ?? "That did not save. Please try again." };
    return {};
  } catch {
    return { error: "Could not reach the system. Check your internet and try again." };
  }
}

export async function remove(url: string): Promise<{ error?: string }> {
  try {
    const res = await fetch(url, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error ?? "That did not delete. Please try again." };
    return {};
  } catch {
    return { error: "Could not reach the system. Check your internet and try again." };
  }
}
