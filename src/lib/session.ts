// The signed cookie that stands between the internet and 85 workers' wages.
//
// Web Crypto only, no Node crypto: this same code runs inside the proxy, which
// gates every page, and inside the route handlers, which gate the data. One
// implementation means the two can never drift apart and disagree about who is
// let in.

export const SESSION_COOKIE = "tunglam-session";

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Backed by a plain ArrayBuffer rather than ArrayBufferLike, which is what
// crypto.subtle.verify will accept.
function fromB64url(s: string): Uint8Array<ArrayBuffer> | null {
  try {
    const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(new ArrayBuffer(b.length));
    for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Token is `<expiry-in-ms>.<signature of that expiry>`. */
export async function signSession(expiresAt: number, secret: string): Promise<string> {
  const payload = String(expiresAt);
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

/**
 * True only for a token this server signed that has not yet expired.
 *
 * An unset secret verifies nothing rather than everything — a misconfigured
 * deployment must lock the door, not leave it open.
 */
export async function verifySession(
  token: string | undefined | null,
  secret: string,
  now: number = Date.now(),
): Promise<boolean> {
  if (!token || !secret) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return false;
  const sig = fromB64url(token.slice(dot + 1));
  if (!sig) return false;
  try {
    return await crypto.subtle.verify("HMAC", await hmacKey(secret), sig, enc.encode(payload));
  } catch {
    return false;
  }
}

/** Compare without letting the clock reveal how much of the password matched. */
export function timingSafeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
