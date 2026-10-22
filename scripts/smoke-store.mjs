// Dev smoke test of storefront journeys + a real admin mutation. Usage: BASE=... ADMIN_* env, SHOTS=dir
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:3000";
const out = process.env.SHOTS;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const results = [];
const check = (name, cond, extra = "") => { results.push(cond); console.log(cond ? "PASS" : "FAIL", name, extra); };

for (const [label, vp] of [["desktop", { width: 1360, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  const page = await (await browser.newContext({ viewport: vp })).newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(base + "/", { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(`${label}: home has no horizontal overflow`, !overflow);
  if (out) await page.screenshot({ path: `${out}/store_home_${label}.png`, fullPage: false });
  await page.goto(base + "/shop", { waitUntil: "networkidle" });
  check(`${label}: shop shows product cards`, (await page.locator('a[href^="/product/"]').count()) >= 12);
  if (out) await page.screenshot({ path: `${out}/store_shop_${label}.png` });
  check(`${label}: shop no overflow`, !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));
  check(`${label}: no page errors`, errs.length === 0, errs.join("|"));
}

const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
await page.goto(base + "/categories", { waitUntil: "networkidle" });
const catText = await page.locator("main").innerText();
check("categories page shows non-zero product counts", /[1-9]\d* products?/i.test(catText), (catText.match(/\d+ products?/gi) ?? []).slice(0, 3).join(","));

await page.goto(base + "/search?q=earbuds", { waitUntil: "networkidle" });
check("search finds earbuds", (await page.locator('a[href^="/product/"]').count()) > 0);

await page.goto(base + "/product/usb-c-charging-cable", { waitUntil: "networkidle" });
if (out) await page.screenshot({ path: `${out}/store_pdp.png` });
await page.getByRole("button", { name: /add to cart/i }).first().click();
await page.waitForTimeout(800);
await page.goto(base + "/cart", { waitUntil: "networkidle" });
check("cart contains the product", /USB-C Charging Cable/i.test(await page.locator("main").innerText()));
if (out) await page.screenshot({ path: `${out}/store_cart.png` });

await page.goto(base + "/checkout", { waitUntil: "networkidle" });
if (out) await page.screenshot({ path: `${out}/store_checkout.png` });
const r404 = await page.goto(base + "/product/nope");
check("unknown product is 404", r404.status() === 404);

// admin mutation: edit a product price and confirm storefront reflects it, then restore
const admin = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
await admin.goto(base + "/admin/login");
await admin.fill('input[name="email"]', process.env.ADMIN_EMAIL);
await admin.fill('input[name="password"]', process.env.ADMIN_PASSWORD);
await Promise.all([admin.waitForURL(/\/admin(?!\/login)/), admin.click('button[type="submit"]')]);
await admin.goto(base + "/admin/products?q=USB-C+Charging+Cable");
const link = await admin.locator('a[href^="/admin/products/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")).find((h) => /products\/[0-9a-f-]{36}/.test(h)));
await admin.goto(base + link, { waitUntil: "networkidle" });
const orig = await admin.inputValue('input[name="retailPrice"]');
await admin.fill('input[name="retailPrice"]', "1234.50");
await admin.locator('[data-testid="product-form"] button[type="submit"]').click();
await admin.waitForURL(/ok=/, { timeout: 15000 }).catch(() => {});
await page.goto(base + "/product/usb-c-charging-cable", { waitUntil: "networkidle" });
check("admin price edit shows on storefront", /1,234\.50/.test(await page.locator("main").innerText()));
await admin.goto(base + link, { waitUntil: "networkidle" });
await admin.fill('input[name="retailPrice"]', orig);
await admin.locator('[data-testid="product-form"] button[type="submit"]').click();
await admin.waitForURL(/ok=/, { timeout: 15000 }).catch(() => {});
await page.goto(base + "/product/usb-c-charging-cable", { waitUntil: "networkidle" });
check("price restored", !/1,234\.50/.test(await page.locator("main").innerText()));

// customer cannot open admin
const cust = await (await browser.newContext()).newPage();
const resp = await cust.goto(base + "/admin/orders", { waitUntil: "networkidle" });
check("anonymous visitor is sent to admin login", /\/admin\/login/.test(cust.url()));
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
