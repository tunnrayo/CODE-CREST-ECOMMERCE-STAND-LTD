# Deployment notes

Nothing is deployed by this repo. To go live:

1. Provision PostgreSQL 14+ (managed or self-hosted) with backups and TLS.
2. Set environment variables from `.env.example` on the host. Set `TRUSTED_PROXY_HOPS` to the number of reverse proxies in front of the app (1 on Railway-style platforms) so rate limits use the real client IP. `SESSION_SECRET` is reserved (sessions use random, hashed server-side tokens), but set it anyway. Set `APP_URL` to the public https URL.
3. `npm ci && npm run build`, then `npm run db:migrate && npm run db:seed && npm run admin:create`, then `npm start` (or run `.next/standalone/server.js`) behind an HTTPS reverse proxy that sets `X-Forwarded-Host`/`X-Forwarded-Proto`.
4. Persist `UPLOAD_DIR` (default `./storage/uploads`) on a volume or move uploads to object storage.
5. Payments: add Paystack keys, register the webhook `https://<domain>/api/v1/payments/webhooks/paystack`, run a Paystack **test-mode** order end to end, then switch order mode to LIVE in Admin → Store settings.
6. Email: verify a sending domain in Resend, set `RESEND_API_KEY` and `EMAIL_FROM`.
7. Before launch: confirm delivery fees, review policy pages with a lawyer, replace the owner-supplied board images (all 125 products use them; source/permission recorded as owner-supplied, verification pending) with cleared product photos, verify supplier costs, change the admin password, and use a multi-instance-safe rate limiter if scaling out.

## Railway / similar platforms (not deployed from this repo)

- Build: `npm ci && npm run build`. Start: `npm start` (listens on `$PORT`, default 3002).
- Health check path: `GET /api/health` (returns 200 `{"status":"ok","database":"ok"}`; non-200 if the database is unreachable).
- First deploy only: run `npm run db:migrate && npm run db:seed && npm run admin:create` once (set `ADMIN_EMAIL`/`ADMIN_PASSWORD` as platform variables; remove `ADMIN_PASSWORD` afterwards if you prefer).
- Attach a persistent volume and point `UPLOAD_DIR` at it, otherwise images uploaded in the admin disappear on redeploy. Board images in `public/products` ship with the build.
- The in-memory rate limiter is per instance; run a single instance or replace it with a shared store before scaling out.

## Security checks you can re-run

`node scripts/smoke-admin-security.mjs` (admin isolation: anonymous, customer, forged/expired/logged-out sessions, cross-origin writes, order privacy), `node scripts/smoke-orders.mjs` (checkout → admin fulfilment → tracking), `node scripts/smoke-crawl.mjs` (every public link at desktop/tablet/mobile). All need the server running; see README.
