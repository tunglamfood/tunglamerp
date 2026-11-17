import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("./supabase-server", () => ({ serverSupabase: () => ({}) }));
const { orderSmsOn, orderSmsText } = await import("./sms");

describe("order SMS", () => {
  it("fits one plain SMS for every kind of change", () => {
    for (const kind of ["confirmed", "delivered", "cancelled", "adjusted"]) {
      const t = orderSmsText(kind, "SO-2026-11-0123", "2026-11-19")!;
      expect(t.length).toBeLessThanOrEqual(160);
      expect(/^[\x20-\x7e]+$/.test(t)).toBe(true);
    }
    expect(orderSmsText("confirmed", "SO-1", "2026-11-19")).toContain("delivery 19 Nov");
    expect(orderSmsText("submitted", "SO-1", null)).toBeNull();
  });

  it("stays off unless ORDER_SMS=on and OneWay is set up", () => {
    expect(orderSmsOn()).toBe(false);
  });
});
