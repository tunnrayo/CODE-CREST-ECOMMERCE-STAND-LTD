// Crawls every internal link reachable from the home page (plus all product pages) at desktop/tablet/mobile.
// Reports HTTP errors, console errors, failed requests, broken images and horizontal overflow.
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:3002";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const sizes = { desktop: [1360, 900], tablet: [820, 1180], mobile: [390, 844] };
const issues = [];
const seen = new Set();
const queue = ["/"];
const skip = (u) => /^\/(admin|api|_next)|\.(png|jpg|webp|svg|xml|txt|pdf)$/.test(u) || u.startsWith("/order/") || u.startsWith("/account/") && !/\/account\/(login|register)$/.test(u);
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
let consoleErrs = [], failed = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrs.push(m.text().slice(0, 200)); });
page.on("requestfailed", (r) => { const t = r.failure()?.errorText ?? ""; if (!t.includes("ERR_ABORTED")) failed.push(r.url() + " " + t); }); // aborted = prefetch cancelled by navigation
page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/api/v1/auth/me")) failed.push(r.status() + " " + r.url()); });
while (queue.length && seen.size < 220) {
  const u = queue.shift();
  if (seen.has(u)) continue;
  seen.add(u);
  consoleErrs = []; failed = [];
  const r = await page.goto(base + u, { waitUntil: "networkidle" }).catch((e) => ({ status: () => 0, err: e }));
  const st = r.status();
  if (st >= 400 || st === 0) issues.push(`HTTP ${st} ${u}`);
  if (consoleErrs.length) issues.push(`console ${u}: ${consoleErrs[0]}`);
  if (failed.length) issues.push(`network ${u}: ${failed[0]}`);
  const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
  for (let h of hrefs) {
    if (!h || h.startsWith("#") || h.startsWith("mailto:") || h.startsWith("tel:") || h.startsWith("javascript:")) continue;
    if (/^https?:/.test(h)) { if (h.startsWith(base)) h = h.slice(base.length); else continue; }
    h = h.split("#")[0];
    if (h && !skip(h) && !seen.has(h)) queue.push(h);
  }
}
console.log("crawled", seen.size, "pages");
// layout checks across viewports on key pages
const key = ["/", "/shop", "/cart", "/checkout", "/about", "/contact", "/faq", "/track-order", "/terms", "/privacy-policy", "/returns-policy", "/shipping-policy", "/account/login", "/admin/login"];
const products = [...seen].filter((u) => u.startsWith("/product")).slice(0, 3);
for (const [name, [w, h]] of Object.entries(sizes)) {
  const c = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await c.newPage();
  for (const u of [...key, ...products]) {
    const r = await p.goto(base + u, { waitUntil: "networkidle" }).catch(() => null);
    if (!r || r.status() >= 400) { issues.push(`${name} HTTP ${r?.status()} ${u}`); continue; }
    const o = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - window.innerWidth, broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length }));
    if (o.over > 1) issues.push(`${name} horizontal overflow ${o.over}px ${u}`);
    if (o.broken) issues.push(`${name} ${o.broken} broken image(s) ${u}`);
  }
  await c.close();
}
console.log(issues.length ? "ISSUES:\n" + issues.join("\n") : "no issues");
await browser.close();
process.exit(issues.length ? 1 : 0);
