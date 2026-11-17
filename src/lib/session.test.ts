import { describe, expect, it } from "vitest";
import { SESSION_COOKIE, signSession, timingSafeEqual, verifySession, type SessionClaims } from "./session";
import { areaFor, canOpen } from "./areas";

const SECRET = "test-secret-value";
const HOUR = 3600_000;
const claims = (over: Partial<SessionClaims> = {}): SessionClaims => ({
  u: 7, v: 1, a: ["sales"], exp: Date.now() + HOUR, ...over,
});

describe("session token", () => {
  it("names the cookie", () => {
    expect(SESSION_COOKIE).toBe("tunglam-session");
  });

  it("accepts a token it just signed, and gives back who and what", async () => {
    const token = await signSession(claims({ m: 1 }), SECRET);
    const got = await verifySession(token, SECRET);
    expect(got?.u).toBe(7);
    expect(got?.v).toBe(1);
    expect(got?.a).toEqual(["sales"]);
    expect(got?.m).toBe(1);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signSession(claims(), SECRET);
    expect(await verifySession(token, "other-secret")).toBeNull();
  });

  it("rejects claims that were changed after signing — more areas, another person", async () => {
    const token = await signSession(claims(), SECRET);
    const sig = token.split(".")[1];
    const forge = (c: SessionClaims) =>
      `${Buffer.from(JSON.stringify(c)).toString("base64url")}.${sig}`;
    expect(await verifySession(forge(claims({ a: ["sales", "hr", "admin"] })), SECRET)).toBeNull();
    expect(await verifySession(forge(claims({ u: 1 })), SECRET)).toBeNull();
    expect(await verifySession(forge(claims({ exp: Date.now() + 100 * HOUR })), SECRET)).toBeNull();
  });

  it("rejects an expired token even though the signature is good", async () => {
    const token = await signSession(claims({ exp: Date.now() - HOUR }), SECRET);
    expect(await verifySession(token, SECRET)).toBeNull();
  });

  it("rejects everything when no secret is configured", async () => {
    const token = await signSession(claims(), SECRET);
    expect(await verifySession(token, "")).toBeNull();
  });

  it("rejects the old shared-password cookie", async () => {
    // `<expiry>.<signature>` — what every browser held before personal logins.
    const old = `${Date.now() + HOUR}.c2lnbmF0dXJl`;
    expect(await verifySession(old, SECRET)).toBeNull();
  });

  it("rejects rubbish", async () => {
    expect(await verifySession(undefined, SECRET)).toBeNull();
    expect(await verifySession(null, SECRET)).toBeNull();
    expect(await verifySession("", SECRET)).toBeNull();
    expect(await verifySession("no-dot", SECRET)).toBeNull();
    expect(await verifySession("abc.def", SECRET)).toBeNull();
    expect(await verifySession(".", SECRET)).toBeNull();
  });
});

describe("areas", () => {
  it("puts wages behind HR and orders behind sales", () => {
    expect(areaFor("/month")).toBe("hr");
    expect(areaFor("/api/month/export")).toBe("hr");
    expect(areaFor("/reports/payslips")).toBe("hr");
    expect(areaFor("/api/workers")).toBe("hr");
    expect(areaFor("/sales/orders")).toBe("sales");
    expect(areaFor("/api/sales/leads")).toBe("sales");
    expect(areaFor("/staff")).toBe("admin");
    expect(areaFor("/home")).toBeNull();
    expect(areaFor("/account")).toBeNull();
  });

  it("does not match a longer word that only starts the same", () => {
    expect(areaFor("/monthly-report")).toBeNull();
    expect(areaFor("/salesman")).toBeNull();
  });

  it("lets a sales login into sales but not into wages", () => {
    expect(canOpen(["sales"], "/sales/enquiries")).toBe(true);
    expect(canOpen(["sales"], "/month")).toBe(false);
    expect(canOpen(["sales"], "/api/reports/payslips")).toBe(false);
    expect(canOpen(["sales"], "/home")).toBe(true);
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
