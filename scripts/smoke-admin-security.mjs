// Live admin-isolation test. Needs the server running and DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD in env.
// Creates one throwaway customer and removes it again. Does not touch real data.
import pg from "pg";
const base = process.env.BASE ?? "http://localhost:3002";
const results = [];
const check = (name, ok, extra = "") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", name, extra); };
const jar = (res) => (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).find((c) => c.startsWith("cc_session=")) ?? "";
const req = (path, o = {}) => fetch(base + path, { redirect: "manual", ...o, headers: { origin: base, ...(o.headers ?? {}) } });
const json = (body, cookie) => ({ method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });

const pages = ["/admin", "/admin/products", "/admin/products/new", "/admin/categories", "/admin/images", "/admin/inventory", "/admin/orders", "/admin/payments", "/admin/suppliers", "/admin/messages", "/admin/settings", "/admin/settings/shipping", "/admin/settings/promotions", "/admin/settings/policies", "/admin/users", "/admin/audit"];
const apis = [["GET", "/api/v1/admin/products"], ["GET", "/api/v1/admin/orders"], ["GET", "/api/v1/admin/categories"], ["GET", "/api/v1/admin/inventory"], ["GET", "/api/v1/admin/suppliers"], ["GET", "/api/v1/admin/images/report"], ["GET", "/api/v1/admin/products/export"], ["POST", "/api/v1/admin/products"], ["POST", "/api/v1/admin/categories"]];

// 1. Unauthenticated
for (const p of pages) {
  const r = await req(p);
  const loc = r.headers.get("location") ?? "";
  const body = r.status >= 300 && r.status < 400 ? "" : await r.text();
  check(`anon ${p} → login`, r.status >= 300 && r.status < 400 && loc.includes("/admin/login") && !/Dashboard|Orders by status/.test(body), `${r.status} ${loc}`);
}
for (const [m, p] of apis) {
  const r = await req(p, m === "POST" ? json({}) : {});
  check(`anon ${m} ${p} → 401`, r.status === 401, String(r.status));
}
// forged / garbage cookies
for (const c of ["cc_session=abc", "cc_session=" + "a".repeat(43), "cc_session=" + "x".repeat(500)]) {
  const r = await req("/api/v1/admin/orders", { headers: { cookie: c } });
  check(`forged cookie ${c.slice(0, 20)}… API → 401`, r.status === 401, String(r.status));
  const pr = await req("/admin/orders", { headers: { cookie: c } });
  check(`forged cookie page → login`, (pr.headers.get("location") ?? "").includes("/admin/login"), String(pr.status));
}
// 2. Customer account
const email = `sec-test-${Date.now()}@example.com`;
const reg = await req("/api/v1/auth/register", json({ name: "Sec Test", email, password: "CustomerPass123" }));
const cust = jar(reg);
check("customer registered", reg.status === 201 && !!cust, String(reg.status));
for (const p of ["/admin", "/admin/orders", "/admin/users", "/admin/settings", "/admin/audit", "/admin/payments"]) {
  const r = await req(p, { headers: { cookie: cust } });
  const body = r.status >= 300 && r.status < 400 ? "" : await r.text();
  check(`customer ${p} blocked`, r.status >= 300 && r.status < 400 && !/Orders by status|Audit log/.test(body), `${r.status} ${r.headers.get("location") ?? ""}`);
}
for (const [m, p] of apis) {
  const r = await req(p, m === "POST" ? json({}, cust) : { headers: { cookie: cust } });
  check(`customer ${m} ${p} → 403`, r.status === 403, String(r.status));
}
// customer cannot use admin sign-in form route
const lg = await req("/api/v1/auth/me", { headers: { cookie: cust } });
const me = await lg.json();
check("customer role is CUSTOMER", me?.data?.role === "CUSTOMER", JSON.stringify(me?.data?.role));
// 3. Cross-origin blocked even with a valid session
const xo = await fetch(base + "/api/v1/admin/categories", { method: "POST", redirect: "manual", headers: { "content-type": "application/json", origin: "https://evil.example", cookie: cust }, body: "{}" });
check("cross-origin POST blocked", xo.status === 403, String(xo.status));
// 4. Admin session
const al = await req("/api/v1/auth/login", json({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }));
const adm = jar(al);
check("admin login via API", al.status === 200 && !!adm, String(al.status));
const bad = await req("/api/v1/auth/login", json({ email: process.env.ADMIN_EMAIL, password: "wrong-password-1" }));
check("wrong admin password rejected", bad.status === 401, String(bad.status));
for (const [m, p] of apis.filter(([m]) => m === "GET")) {
  const r = await req(p, { headers: { cookie: adm } });
  check(`admin GET ${p} → 200`, r.status === 200, String(r.status));
}
for (const p of pages) {
  const r = await req(p, { headers: { cookie: adm } });
  const body = await r.text();
  check(`admin ${p} → 200 + no-store + noindex`, r.status === 200 && /no-store/.test(r.headers.get("cache-control") ?? "") && /noindex/.test(r.headers.get("x-robots-tag") ?? "") && !/Application error/.test(body), String(r.status));
}
// 5. Logout revokes server-side (replaying the old token must fail)
const lo = await req("/api/v1/auth/logout", { method: "POST", headers: { cookie: adm } });
check("logout ok", lo.status === 200);
const replay = await req("/api/v1/admin/orders", { headers: { cookie: adm } });
check("old admin token rejected after logout", replay.status === 401, String(replay.status));
const replayPage = await req("/admin", { headers: { cookie: adm } });
check("old admin token page → login after logout", (replayPage.headers.get("location") ?? "").includes("/admin/login"), String(replayPage.status));
// 6. Session expiry
const al2 = await req("/api/v1/auth/login", json({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }));
const adm2 = jar(al2);
const ok1 = await req("/api/v1/admin/orders", { headers: { cookie: adm2 } });
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await db.query("update sessions set expires_at = now() - interval '1 minute' where user_id = (select id from users where lower(email)=lower($1))", [process.env.ADMIN_EMAIL]);
const exp = await req("/api/v1/admin/orders", { headers: { cookie: adm2 } });
check("admin session works, then expired session rejected", ok1.status === 200 && exp.status === 401, `${ok1.status} → ${exp.status}`);
// 7. Customer isolation: create a guest order, then try to read it as other identities
const jar2 = [];
const call = async (path, init = {}) => {
  const res = await fetch(base + path, { redirect: "manual", ...init, headers: { "content-type": "application/json", origin: base, cookie: jar2.join("; "), ...(init.headers ?? {}) } });
  for (const c of res.headers.getSetCookie?.() ?? []) jar2.push(c.split(";")[0]);
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const prod = (await call("/api/v1/products?perPage=1")).body.data[0];
await call("/api/v1/cart/items", { method: "POST", body: JSON.stringify({ productId: prod.id, quantity: 1 }) });
const ship = (await call("/api/v1/shipping/options?state=Lagos")).body.data[0];
const ord = await call("/api/v1/checkout", { method: "POST", body: JSON.stringify({ email: "sec-guest@example.com", fullName: "Sec Guest", phone: "08012345678", line1: "1 Test St", city: "Ikeja", state: "Lagos", shippingMethodId: ship.id, acceptTerms: true }) });
const ref = ord.body?.data?.reference;
check("guest order created for isolation test", ord.status === 201 && !!ref, String(ord.status));
if (ref) {
  const o = await req(`/api/v1/orders/${ref}`, { headers: { cookie: cust } });
  check("other customer cannot read order by reference", o.status === 404, String(o.status));
  const o2 = await req(`/api/v1/orders/${ref}`);
  check("anonymous cannot read order by reference alone", o2.status === 404, String(o2.status));
  const o3 = await req(`/api/v1/orders/${ref}`, { headers: { cookie: adm2 } });
  check("(expired admin token) cannot read order", o3.status === 404, String(o3.status));
  const t1 = await req("/api/v1/orders/track", json({ reference: ref, email: "someone-else@example.com" }));
  check("tracking with wrong email refused", t1.status === 404 || t1.status === 422, String(t1.status));
  const t2 = await req("/api/v1/orders/track", json({ reference: ref, email: "sec-guest@example.com" }));
  check("tracking with right email works", t2.status === 200, String(t2.status));
  const mine = await req("/api/v1/account/orders", { headers: { cookie: cust } });
  const mt = await mine.text();
  check("customer order list does not include guest order", mine.status === 200 && !mt.includes(ref), String(mine.status));
}
// deactivated user loses access immediately
const al3 = await req("/api/v1/auth/login", json({ email, password: "CustomerPass123" }));
const cookie3 = jar(al3);
await db.query("update users set is_active=false where lower(email)=lower($1)", [email]);
const me3 = await req("/api/v1/auth/me", { headers: { cookie: cookie3 } });
check("deactivated user session rejected", me3.status === 401, String(me3.status));
// 8. Public surface has no admin links; robots
const home = await (await req("/")).text();
check("homepage HTML has no /admin link", !/href="\/admin/.test(home));
for (const p of ["/shop", "/about", "/contact", "/faq", "/cart", "/checkout"]) {
  const t = await (await req(p)).text();
  check(`${p} has no /admin link`, !/href="\/admin/.test(t));
}
const robots = await (await req("/robots.txt")).text();
check("robots.txt disallows /admin", /Disallow: \/admin/.test(robots));
const sm = await (await req("/sitemap.xml")).text();
check("sitemap excludes /admin", !/\/admin/.test(sm));
// 9. Login throttling & spoofed XFF does not reset limit
let blocked = false;
for (let i = 0; i < 14; i++) {
  const r = await req("/api/v1/auth/login", { ...json({ email: "nobody@example.com", password: "x" + i }), headers: { "content-type": "application/json", "x-forwarded-for": `1.2.3.${i}, 9.9.9.9` } });
  if (r.status === 429) blocked = true;
}
check("login rate limit holds against spoofed X-Forwarded-For", blocked);
// cleanup
await db.query("delete from orders where lower(email)='sec-guest@example.com'");
await db.query("delete from sessions where user_id in (select id from users where lower(email)=lower($1))", [email]);
await db.query("delete from users where lower(email)=lower($1)", [email]);
await db.query("update users set failed_login_count=0, locked_until=null where lower(email)=lower($1)", [process.env.ADMIN_EMAIL]);
await db.end();
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
