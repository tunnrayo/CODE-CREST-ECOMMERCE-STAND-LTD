// Image checks against a running server: every product's image URL resolves, and images render in the browser.
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:3002";
const all = [];
for (let page = 1; page <= 3; page++) {
  const r = await (await fetch(`${base}/api/v1/products?perPage=60&page=${page}`)).json();
  all.push(...r.data);
}
let own = 0, fallback = 0, bad = [];
for (const p of all) {
  const url = p.image.url;
  const res = await fetch(base + url);
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !/image\//.test(type)) bad.push(`${p.sku} ${url} -> ${res.status} ${type}`);
  if (url.endsWith("product-fallback.svg")) fallback++; else own++;
}
console.log(`products via API: ${all.length}; own image: ${own}; placeholder: ${fallback}; broken image URLs: ${bad.length}`);
bad.forEach((b) => console.log("  BAD", b));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
let failures = bad.length;
for (const [label, vp] of [["desktop", { width: 1360, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  const page = await (await browser.newContext({ viewport: vp })).newPage();
  for (const path of ["/", "/shop", "/shop?page=3", "/category/home-kitchen", "/product/non-stick-frying-pan"]) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll("main img")];
      return { total: imgs.length, broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length, overflow: document.documentElement.scrollWidth > window.innerWidth + 1 };
    });
    const ok = r.broken === 0 && !r.overflow;
    if (!ok) failures++;
    console.log(ok ? "PASS" : "FAIL", label, path, JSON.stringify(r));
  }
}
await browser.close();
process.exit(failures ? 1 : 0);
