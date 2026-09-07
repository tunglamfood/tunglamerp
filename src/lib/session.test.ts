import { describe, expect, it } from "vitest";
import { SESSION_COOKIE, signSession, timingSafeEqual, verifySession } from "./session";

const SECRET = "test-secret-value";
const HOUR = 3600_000;

describe("session token", () => {
  it("names the cookie", () => {
    expect(SESSION_COOKIE).toBe("tunglam-session");
  });

  it("accepts a token it just signed", async () => {
    const token = await signSession(Date.now() + HOUR, SECRET);
    expect(await verifySession(token, SECRET)).toBe(true);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signSession(Date.now() + HOUR, SECRET);
    expect(await verifySession(token, "other-secret")).toBe(false);
  });

  it("rejects a tampered expiry", async () => {
    const token = await signSession(Date.now() + HOUR, SECRET);
    const forged = `${Date.now() + 100 * HOUR}.${token.split(".")[1]}`;
    expect(await verifySession(forged, SECRET)).toBe(false);
  });

  it("rejects an expired token even though the signature is good", async () => {
    const token = await signSession(Date.now() - HOUR, SECRET);
    expect(await verifySession(token, SECRET)).toBe(false);
  });

  it("rejects everything when no secret is configured", async () => {
    const token = await signSession(Date.now() + HOUR, SECRET);
    expect(await verifySession(token, "")).toBe(false);
  });

  it("rejects rubbish", async () => {
    expect(await verifySession(undefined, SECRET)).toBe(false);
    expect(await verifySession(null, SECRET)).toBe(false);
    expect(await verifySession("", SECRET)).toBe(false);
    expect(await verifySession("no-dot", SECRET)).toBe(false);
    expect(await verifySession("abc.def", SECRET)).toBe(false);
    expect(await verifySession(".", SECRET)).toBe(false);
  });
});

describe("timingSafeEqual", () => {
  it("matches identical strings", () => {
    expect(timingSafeEqual("12341234", "12341234")).toBe(true);
  });

  it("rejects different strings of the same length", () => {
    expect(timingSafeEqual("12341234", "12341235")).toBe(false);
  });

  it("rejects different lengths", () => {
    expect(timingSafeEqual("12341234", "1234")).toBe(false);
    expect(timingSafeEqual("", "1234")).toBe(false);
  });
});
