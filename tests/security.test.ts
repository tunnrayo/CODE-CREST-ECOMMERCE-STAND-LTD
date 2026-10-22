import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { can, validatePasswordStrength } from "@/server/auth/core";
import { sniffImageType } from "@/server/services/images";
import { calculateMargin } from "@/server/services/suppliers";
import { parseCsv } from "@/server/services/admin-catalogue";
import { ORDER_TRANSITIONS } from "@/server/services/orders";
import { verifyWebhookSignature } from "@/server/services/payments";

describe("permissions (RBAC)", () => {
  it("customers have no admin access", () => {
    for (const p of ["admin:access", "catalogue:write", "orders:read", "payments:read", "users:manage"] as const) expect(can("CUSTOMER", p)).toBe(false);
    expect(can(undefined, "admin:access")).toBe(false);
  });
  it("staff cannot manage payments, settings or users", () => {
    expect(can("STAFF", "orders:write")).toBe(true);
    expect(can("STAFF", "payments:read")).toBe(false);
    expect(can("STAFF", "settings:write")).toBe(false);
    expect(can("STAFF", "users:manage")).toBe(false);
  });
  it("admin can do everything", () => {
    for (const p of ["payments:read", "settings:write", "users:manage", "audit:read"] as const) expect(can("ADMIN", p)).toBe(true);
  });
});

describe("password strength", () => {
  it("rejects weak and accepts strong passwords", () => {
    expect(validatePasswordStrength("short")).not.toBeNull();
    expect(validatePasswordStrength("alllowercaseletters")).not.toBeNull();
    expect(validatePasswordStrength("Str0ng&LongEnough!")).toBeNull();
  });
});

describe("image sniffing", () => {
  it("detects real image magic bytes and rejects others", () => {
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("image/jpeg");
    expect(sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))).toBe("image/png");
    expect(sniffImageType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
    expect(sniffImageType(Buffer.from("#!/bin/sh\necho hi\n\n\n"))).toBeNull();
  });
});

describe("margin calculation", () => {
  it("is unavailable without a verified cost", () => {
    expect(calculateMargin(1_000_000, null).available).toBe(false);
    expect(calculateMargin(1_000_000, { costMinor: 500_000, costCurrency: "NGN", additionalCostsKobo: null, costVerifiedAt: null }).available).toBe(false);
  });
  it("computes margin from a verified NGN cost plus extras", () => {
    const m = calculateMargin(1_000_000, { costMinor: 600_000, costCurrency: "NGN", additionalCostsKobo: 100_000, costVerifiedAt: new Date() });
    expect(m.available).toBe(true);
    if (m.available) expect(m.marginKobo).toBe(300_000);
  });
  it("refuses foreign-currency costs (no invented exchange rate)", () => {
    expect(calculateMargin(1_000_000, { costMinor: 1000, costCurrency: "USD", additionalCostsKobo: null, costVerifiedAt: new Date() }).available).toBe(false);
  });
});

describe("CSV parsing", () => {
  it("handles quotes, commas and newlines", () => {
    expect(parseCsv('a,"b,c","d ""q"""\n1,2,3\n')).toEqual([["a", "b,c", 'd "q"'], ["1", "2", "3"]]);
  });
});

describe("order state machine", () => {
  it("does not allow skipping or reviving orders", () => {
    expect(ORDER_TRANSITIONS.PENDING).not.toContain("DELIVERED");
    expect(ORDER_TRANSITIONS.DELIVERED ?? []).not.toContain("PENDING");
    expect(ORDER_TRANSITIONS.CANCELLED ?? []).toHaveLength(0);
  });
});

describe("paystack webhook signature", () => {
  it("accepts only a valid HMAC-SHA512 of the raw body", () => {
    process.env.PAYSTACK_SECRET_KEY = "sk_test_unit_only_dummy";
    const body = JSON.stringify({ event: "charge.success" });
    const good = crypto.createHmac("sha512", "sk_test_unit_only_dummy").update(body).digest("hex");
    expect(verifyWebhookSignature(body, good)).toBe(true);
    expect(verifyWebhookSignature(body, good.replace(/.$/, "0"))).toBe(false);
    expect(verifyWebhookSignature(body, null)).toBe(false);
  });
});
