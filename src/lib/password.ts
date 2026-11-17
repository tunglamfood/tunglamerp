// Staff passwords. Only a scrypt hash is ever stored:
//   scrypt$<N>$<r>$<p>$<salt>$<hash>   (salt and hash base64url)
// tunglamfood.my checks the same hashes for its content admin, with a copy of
// verifyPassword in src/lib/admin/password.ts there — keep the format in step.
import "server-only";
import { randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const LEN = 32;

function derive(password: string, salt: Buffer, n: number, r: number, p: number, len: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, len, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, N, R, P, LEN);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [n, r, p] = parts.slice(1, 4).map(Number);
  if (![n, r, p].every((x) => Number.isInteger(x) && x > 0) || n > 1 << 17) return false;
  const salt = Buffer.from(parts[4], "base64url");
  const expected = Buffer.from(parts[5], "base64url");
  if (salt.length < 8 || expected.length < 16) return false;
  const got = await derive(password, salt, n, r, p, expected.length);
  return timingSafeEqual(got, expected);
}

/** A hash that matches nothing, checked when the username is unknown so both paths take as long. */
export const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

/** Easy to read out over the phone: no 0/o, 1/l/i. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** A one-time password the owner hands over; the person must change it at first sign-in. */
export function tempPassword(): string {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${group()}-${group()}-${group()}`;
}

/** Why a new password will not do, or null when it is fine. */
export function passwordProblem(password: string, username?: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (password.length > 200) return "That password is too long.";
  if (/^(.)\1+$/.test(password)) return "Use more than one repeated character.";
  if (/^(?:12345678|123456789|1234567890|12341234|password|11111111|00000000|tunglam\d*)$/i.test(password)) {
    return "That password is too easy to guess.";
  }
  if (username && password.toLowerCase().includes(username.toLowerCase())) return "Don't put your username in your password.";
  return null;
}
