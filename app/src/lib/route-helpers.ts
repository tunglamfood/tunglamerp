// The same three lines every record route needs: check the cookie, read the
// body, and turn any failure into a sentence rather than a stack trace.
import "server-only";
import { requireSession } from "./supabase-server";

export const unauthorised = () =>
  Response.json({ error: "Please sign in again." }, { status: 401 });

export const problem = (message: string, status = 400) =>
  Response.json({ error: message }, { status });

export async function guard(): Promise<Response | null> {
  return (await requireSession()) ? null : unauthorised();
}

export async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Runs the work, and reports whatever went wrong in plain words. */
export async function attempt<T>(work: () => Promise<T>): Promise<Response> {
  try {
    const value = await work();
    return Response.json({ ok: true, value: value ?? null });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

export const str = (v: unknown, fallback = "") => (v == null ? fallback : String(v).trim());

export const strOrNull = (v: unknown) => {
  const s = str(v);
  return s === "" ? null : s;
};

export const num = (v: unknown, fallback = 0) => {
  const n = Number(String(v ?? "").replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : fallback;
};

export const numOrNull = (v: unknown) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;
