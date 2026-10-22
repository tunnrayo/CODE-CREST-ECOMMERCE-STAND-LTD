/**
 * HTTP-level tests against a running server (default http://localhost:3000).
 * Run `npm run dev` (or `npm start`) against a seeded database first.
 * Skipped automatically if the server is not reachable.
 */
import { beforeAll, describe, expect, it } from "vitest";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
let up = false;
beforeAll(async () => {
  try {
    up = (await fetch(`${BASE}/api/health`)).ok;
  } catch {
    up = false;
  }
});
const j = async (res: Response) => ({ status: res.status, body: await res.json().catch(() => null) });
const origin = { origin: BASE };

describe.runIf(process.env.TEST_BASE_URL || true)("public API", () => {
  it("health check", async ({ skip }) => {
    if (!up) skip();
    const r = await j(await fetch(`${BASE}/api/health`));
    expect(r.status).toBe(200);
  });

  it("lists exactly 125 published products", async ({ skip }) => {
    if (!up) skip();
    const r = await j(await fetch(`${BASE}/api/v1/products?perPage=1`));
    expect(r.body.meta.total).toBe(125);
  });

  it("search finds products and respects price filter", async ({ skip }) => {
    if (!up) skip();
    const r = await j(await fetch(`${BASE}/api/v1/products?q=earbuds&perPage=48`));
    expect(r.body.data.length).toBeGreaterThan(0);
    const cheap = await j(await fetch(`${BASE}/api/v1/products?maxPrice=10000&perPage=60`));
    for (const p of cheap.body.data) expect(p.retailPriceKobo).toBeLessThanOrEqual(1_000_000);
  });

  it("unknown product slug returns 404", async ({ skip }) => {
    if (!up) skip();
    expect((await fetch(`${BASE}/api/v1/products/does-not-exist`)).status).toBe(404);
  });
});

describe("admin API permission boundaries", () => {
  const adminGets = ["/api/v1/admin/products", "/api/v1/admin/products/export", "/api/v1/admin/orders", "/api/v1/admin/categories", "/api/v1/admin/inventory", "/api/v1/admin/suppliers", "/api/v1/admin/images/report"];
  for (const path of adminGets) {
    it(`anonymous GET ${path} is rejected`, async ({ skip }) => {
      if (!up) skip();
      expect([401, 403]).toContain((await fetch(BASE + path)).status);
    });
  }
  it("anonymous cannot create a product", async ({ skip }) => {
    if (!up) skip();
    const res = await fetch(`${BASE}/api/v1/admin/products`, { method: "POST", headers: { "content-type": "application/json", ...origin }, body: "{}" });
    expect([401, 403]).toContain(res.status);
  });
  it("cross-origin writes are blocked", async ({ skip }) => {
    if (!up) skip();
    const res = await fetch(`${BASE}/api/v1/cart/items`, { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: "{}" });
    expect(res.status).toBe(403);
  });
  it("/admin redirects anonymous visitors to the login page", async ({ skip }) => {
    if (!up) skip();
    const res = await fetch(`${BASE}/admin/products`, { redirect: "manual" });
    expect([302, 307, 308]).toContain(res.status);
    expect(res.headers.get("location")).toContain("/admin/login");
  });
});

describe("cart and checkout", () => {
  it("never trusts client prices; validates checkout; creates an order with server totals", async ({ skip }) => {
    if (!up) skip();
    const list = await j(await fetch(`${BASE}/api/v1/products?perPage=1`));
    const product = list.body.data[0];
    const jar: string[] = [];
    const call = async (path: string, init: RequestInit = {}) => {
      const res = await fetch(BASE + path, { ...init, headers: { "content-type": "application/json", ...origin, cookie: jar.join("; "), ...(init.headers ?? {}) } });
      for (const c of res.headers.getSetCookie?.() ?? []) jar.push(c.split(";")[0]);
      return j(res);
    };
    const add = await call("/api/v1/cart/items", { method: "POST", body: JSON.stringify({ productId: product.id, quantity: 2, unitPriceKobo: 1 }) });
    expect(add.status).toBe(201);
    const cart = await call("/api/v1/cart");
    expect(cart.body.data.subtotalKobo).toBe(product.retailPriceKobo * 2 - (product.salePriceKobo ? 2 * (product.retailPriceKobo - product.salePriceKobo) : 0));

    const bad = await call("/api/v1/checkout", { method: "POST", body: JSON.stringify({ email: "nope" }) });
    expect(bad.status).toBe(422);

    const ship = await call("/api/v1/shipping/options?state=Lagos");
    const method = ship.body.data[0];
    const order = await call("/api/v1/checkout", {
      method: "POST",
      body: JSON.stringify({ email: "api-test@example.com", fullName: "API Test", phone: "08012345678", line1: "1 Test Street", city: "Ikeja", state: "Lagos", shippingMethodId: method.id, acceptTerms: true, totalKobo: 1 }),
    });
    expect(order.status).toBe(201);
    expect(order.body.data.totalKobo).toBeGreaterThan(100);
    expect(order.body.data.payment).toBeNull(); // no Paystack configured / REQUEST mode: no fake payment
  });
});
