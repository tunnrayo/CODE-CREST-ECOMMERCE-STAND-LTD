// End-to-end order journey: customer places an order on a phone-sized screen (with a double-click),
// admin finds it, updates status / fee / note / shipment, customer tracks it. Cleans up its own order.
import { chromium } from "playwright";
import pg from "pg";
const base = process.env.BASE ?? "http://localhost:3002";
const out = process.env.SHOTS;
const email = `order-smoke-${Date.now()}@example.com`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const res = [];
const check = (n, ok, x = "") => { res.push(ok); console.log(ok ? "PASS" : "FAIL", n, x); };
const shot = async (p, n) => out && (await p.screenshot({ path: `${out}/${n}.png`, fullPage: false }));
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const cust = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
const errs = [];
cust.on("pageerror", (e) => errs.push(e.message));
await cust.goto(base + "/shop", { waitUntil: "networkidle" });
await cust.locator('article a[href^="/product/"]').first().click();
await cust.waitForURL(/\/product\//);
await cust.getByRole("button", { name: /add to cart/i }).first().click();
await cust.waitForTimeout(800);
await cust.goto(base + "/checkout", { waitUntil: "networkidle" });
await cust.locator('[data-testid="place-order"]').click({ force: true }).catch(() => {});
await cust.waitForTimeout(500);
check("empty checkout shows validation, no order", (await cust.locator(".field-error, [role=alert]").count()) > 0 || (await cust.locator('[data-testid="place-order"]').isDisabled()));
await cust.fill("#co-fullName", "Order Smoke");
await cust.fill("#co-phone", "08031234567");
await cust.fill("#co-email", email);
await cust.fill("#co-line1", "12 Test Avenue");
await cust.fill("#co-city", "Ikeja");
await cust.selectOption("#co-state", "Lagos");
await cust.waitForTimeout(800);
await cust.locator('input[name="shippingMethodId"]').first().check();
await cust.locator('input[name="acceptTerms"]').check();
await shot(cust, "mobile_checkout");
const btn = cust.locator('[data-testid="place-order"]');
await btn.dblclick({ force: true }).catch(() => {});
await cust.waitForURL(/\/order\/CC-/, { timeout: 20000 });
const ref = cust.url().match(/CC-[A-Z0-9-]+/)[0];
await cust.waitForLoadState("networkidle");
await shot(cust, "mobile_order_confirmation");
const n = (await db.query("select count(*)::int n from orders where email=$1", [email])).rows[0].n;
check("double-click created exactly one order", n === 1, `orders=${n}`);
const row = (await db.query("select * from orders where reference=$1", [ref])).rows[0];
check("order stored with name/email/phone/address/totals/status", row.customer_name === "Order Smoke" && row.phone === "08031234567" && row.shipping_address.line1 === "12 Test Avenue" && row.total_kobo === row.subtotal_kobo + row.shipping_kobo && row.status === "PENDING" && row.payment_status === "UNPAID", `${row.status}/${row.payment_status} total=${row.total_kobo}`);
check("no console errors on customer pages", errs.length === 0, errs[0] ?? "");
const emails = (await db.query("select type,status from notifications where related_order_id=$1", [row.id])).rows;
console.log("INFO notifications recorded:", JSON.stringify(emails));

const adm = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
await adm.goto(base + "/admin/login");
await shot(adm, "admin_login");
await adm.fill('input[name="email"]', process.env.ADMIN_EMAIL);
await adm.fill('input[name="password"]', process.env.ADMIN_PASSWORD);
await Promise.all([adm.waitForURL(/\/admin(?!\/login)/), adm.click('button[type="submit"]')]);
await adm.waitForLoadState("networkidle");
await shot(adm, "admin_dashboard");
await adm.goto(base + "/admin/orders", { waitUntil: "networkidle" });
check("order appears in admin list", (await adm.locator("body").innerText()).includes(ref));
await shot(adm, "admin_orders");
await adm.locator(`a:has-text("${ref}")`).first().click();
await adm.waitForURL(/\/admin\/orders\/[0-9a-f-]{36}/);
const detail = adm.url();
// confirm delivery fee
await adm.fill("#sf-fee", "3500");
await adm.fill("#sf-note", "Fee confirmed with customer");
await Promise.all([adm.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/orders/")), adm.getByRole("button", { name: /confirm fee|update fee/i }).click()]); await adm.waitForLoadState("networkidle"); await adm.waitForURL(/ok=Delivery\+fee/); await adm.waitForLoadState("networkidle");
// status
const settle = () => adm.waitForLoadState("networkidle");
const sel = adm.locator('[data-testid="status-form"] select');
await sel.locator("option").first().waitFor({ state: "attached", timeout: 15000 });
const opts = await sel.locator("option").evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
await sel.selectOption(opts.includes("CONFIRMED") ? "CONFIRMED" : opts[0]);
await adm.fill("#os-note", "Availability confirmed");
await Promise.all([adm.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/orders/")), adm.locator('[data-testid="status-form"] button[type="submit"]').click()]); await adm.waitForLoadState("networkidle"); await adm.waitForURL(/ok=Order\+status\+updated/); await adm.waitForLoadState("networkidle");
// internal note
await adm.locator('textarea[name="body"]').fill("Customer asked for evening delivery");
await Promise.all([adm.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/orders/")), adm.getByRole("button", { name: /add note/i }).click()]); await adm.waitForLoadState("networkidle"); await adm.waitForURL(/ok=Note\+added/); await adm.waitForLoadState("networkidle");
// business rule: an unpaid order cannot be processed until payment is verified / recorded through the audited process
{
  const sl0 = adm.locator('[data-testid="status-form"] select');
  await sl0.locator("option").first().waitFor({ state: "attached", timeout: 15000 });
  await sl0.selectOption("PROCESSING");
  await Promise.all([adm.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/orders/")), adm.locator('[data-testid="status-form"] button[type="submit"]').click()]);
  await adm.waitForURL(/error=Payment\+must\+be\+verified/);
  check("unpaid order cannot move to PROCESSING", true);
  await adm.fill('[data-testid="manual-payment-form"] input[name="externalReference"]', "TEST-RECEIPT-001");
  await adm.locator('[data-testid="manual-payment-form"] input[name="confirmation"]').check();
  await Promise.all([adm.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/orders/")), adm.locator('[data-testid="manual-payment-form"] button[type="submit"]').click()]);
  await adm.waitForURL(/ok=/); await adm.waitForLoadState("networkidle");
  const ps = (await db.query("select payment_status from orders where id=$1", [row.id])).rows[0].payment_status;
  check("audited manual payment recorded → PAID", ps === "PAID", ps);
}
// advance through fulfilment: PROCESSING → SHIPPED (record shipment) → DELIVERED
for (const st of ["PROCESSING", "SHIPPED"]) {
  const sl = adm.locator('[data-testid="status-form"] select');
  await sl.locator("option").first().waitFor({ state: "attached", timeout: 15000 });
  await sl.selectOption(st);
  await Promise.all([adm.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/orders/")), adm.locator('[data-testid="status-form"] button[type="submit"]').click()]);
  await adm.waitForURL(/ok=Order\+status\+updated/); await adm.waitForLoadState("networkidle");
}
const canShip = await adm.locator("#sh-c").count();
check("shipment form offered once order is shipped", canShip > 0);
if (canShip) { await adm.fill("#sh-c", "GIG Logistics"); await adm.fill("#sh-t", "TEST-TRACK-1"); await adm.fill("#sh-n", "Leave with gateman"); await Promise.all([adm.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/orders/")), adm.getByRole("button", { name: /record shipment/i }).click()]); await adm.waitForURL(/ok=Shipment\+details/); await adm.waitForLoadState("networkidle"); }
{
  const sl = adm.locator('[data-testid="status-form"] select');
  await sl.locator("option").first().waitFor({ state: "attached", timeout: 15000 });
  await sl.selectOption("DELIVERED");
  await adm.fill("#os-note", "Delivered to customer");
  await Promise.all([adm.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/orders/")), adm.locator('[data-testid="status-form"] button[type="submit"]').click()]);
  await adm.waitForURL(/ok=Order\+status\+updated/); await adm.waitForLoadState("networkidle");
}
await shot(adm, "admin_order_detail");
await adm.reload({ waitUntil: "networkidle" });
const txt = await adm.locator("body").innerText();
const after = (await db.query("select status, shipping_kobo, shipping_confirmed from orders where id=$1", [row.id])).rows[0];
check("status history persisted after refresh (CONFIRMED note visible, final DELIVERED)", after.status === "DELIVERED" && txt.includes("Availability confirmed") && txt.includes("Delivered to customer"), after.status);
check("delivery fee persisted", after.shipping_kobo === 350000 && after.shipping_confirmed === true, String(after.shipping_kobo));
check("internal note persisted after refresh", txt.includes("Customer asked for evening delivery"));
check("shipment / courier details persisted after refresh", txt.includes("TEST-TRACK-1") && txt.includes("GIG Logistics"));
check("admin actions written to audit log", (await db.query("select count(*)::int n from audit_logs where entity_id=$1", [row.id])).rows[0].n > 0);

const trk = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await trk.goto(base + "/track-order", { waitUntil: "networkidle" });
await trk.fill("#t-ref", ref);
await trk.fill("#t-email", email);
await trk.locator("form button.btn-burgundy").click();
await trk.waitForTimeout(1500);
const tt = await trk.locator("body").innerText();
check("customer tracking shows updated status", /delivered/i.test(tt) && tt.includes(ref));
await shot(trk, "mobile_track_order");
const wrong = await (await browser.newContext()).newPage();
await wrong.goto(base + `/order/${ref}`, { waitUntil: "networkidle" });
check("order page without token is not shown to the public", !(await wrong.locator("body").innerText()).includes("Order Smoke"));

if (!process.env.KEEP) {
  await db.query("delete from orders where id=$1", [row.id]);
  await db.query("delete from notifications where related_order_id=$1", [row.id]).catch(() => {});
}
await db.end();
await browser.close();
const f = res.filter((x) => !x).length;
console.log(`\n${res.length - f}/${res.length} passed`);
process.exit(f ? 1 : 0);
