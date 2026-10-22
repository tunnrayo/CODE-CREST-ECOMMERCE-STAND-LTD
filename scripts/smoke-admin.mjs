// Dev smoke test: logs in as admin (password from env ADMIN_PASSWORD) and loads every admin page.
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:3000";
const out = process.env.SHOTS;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror " + e.message));
await page.goto(base + "/admin/login");
await page.fill('input[name="email"]', process.env.ADMIN_EMAIL);
await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD);
await Promise.all([page.waitForURL(/\/admin(?!\/login)/, { timeout: 20000 }), page.click('button[type="submit"]')]);
const paths = ["/admin", "/admin/products", "/admin/products/new", "/admin/categories", "/admin/images", "/admin/inventory", "/admin/orders", "/admin/payments", "/admin/suppliers", "/admin/messages", "/admin/settings", "/admin/settings/shipping", "/admin/settings/promotions", "/admin/settings/policies", "/admin/users", "/admin/audit"];
// first product edit page
await page.goto(base + "/admin/products");
const href = await page.locator('a[href^="/admin/products/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")).find((h) => /products\/[0-9a-f-]{36}/.test(h)));
if (href) paths.push(href);
for (const p of paths) {
  const r = await page.goto(base + p, { waitUntil: "networkidle" });
  const h1 = (await page.locator("h1").first().textContent().catch(() => "")) ?? "";
  const body = await page.locator("body").innerText();
  const bad = /Application error|Internal Server Error|could not be found|Unhandled/i.test(body);
  console.log(r.status(), bad ? "BAD" : "ok ", p, "|", h1.trim().slice(0, 50));
  if (out) await page.screenshot({ path: `${out}/${p.replace(/\W+/g, "_")}.png` });
}
console.log("page errors:", errors.length, errors.slice(0, 3));
await browser.close();
