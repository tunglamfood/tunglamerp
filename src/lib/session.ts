// The signed cookie that stands between the internet and 85 workers' wages.
//
// Web Crypto only, no Node crypto: this same code runs inside the proxy, which
// gates every page, and inside the route handlers, which gate the data. One
// implementation means the two can never drift apart and disagree about who is
// let in.
//
// The cookie says who signed in and what they may open. The server still reads
// the person's row on every request (supabase-server.ts → currentUser), so a
// login switched off or changed stops working at once: every such change bumps
// `session_version`, and a cookie carrying an old version is refused.

export const SESSION_COOKIE = "tunglam-session";

export interface SessionClaims {
  /** erp_users.id */
  u: number;
  /** erp_users.session_version when the cookie was issued. */
  v: number;
  /** The areas this person could open when the cookie was issued. */
  a: string[];
  /** Set while they still have to choose their own password. */
  m?: 1;
  /** Expiry, ms since epoch. */
  exp: number;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  let s = "";
  for (const b of bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)) s += String.fromCharCode(b);
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

/** Token is `<base64url JSON claims>.<signature of that text>`. */
export async function signSession(claims: SessionClaims, secret: string): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify(claims)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

/**
 * The claims of a token this server signed that has not yet expired, or null.
 *
 * An unset secret verifies nothing rather than everything — a misconfigured
 * deployment must lock the door, not leave it open.
 */
export async function verifySession(
  token: string | undefined | null,
  secret: string,
  now: number = Date.now(),
): Promise<SessionClaims | null> {
  if (!token || !secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = fromB64url(token.slice(dot + 1));
  if (!sig) return null;
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), sig, enc.encode(payload));
  } catch {
    return null;
  }
  if (!ok) return null;
  const raw = fromB64url(payload);
  if (!raw) return null;
  try {
    const c = JSON.parse(dec.decode(raw)) as SessionClaims;
    if (!Number.isInteger(c.u) || !Number.isInteger(c.v) || !Array.isArray(c.a)) return null;
    if (!Number.isFinite(c.exp) || c.exp <= now) return null;
    return c;
  } catch {
    return null;
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
