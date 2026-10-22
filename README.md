# Code Crest — E-commerce Platform

**CODE CREST ECOMMERCE STAND LTD** · RC 9792990
ANBEEZ PLAZA, SUITE 1016, NDOLA CRESCENT, WUSE ZONE 5, ABUJA, FCT, NIGERIA · CODECRESTECOMMERCESTAND@GMAIL.COM
*Smart Shopping. Seamless Living.*

A full-stack online store: public storefront, customer accounts, cart, checkout, order tracking, and a secure admin portal. Brand colours: burgundy `#680F24`, lime green `#A8E620`, white, cool grey `#E8E8E8`.

## Stack
Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS · PostgreSQL 16 · Drizzle ORM + SQL migrations · argon2 · zod · sharp · vitest · Playwright (smoke scripts).

## Quick start
```bash
cp .env.example .env            # fill in DATABASE_URL, SESSION_SECRET, ADMIN_* (see below)
npm install
npm run db:migrate              # applies /drizzle migrations
npm run db:seed                 # 125 products from data/catalogue.json, categories, policies (idempotent)
npm run admin:create            # creates/updates the administrator from ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev                     # http://localhost:3000   (admin: /admin)
```
Production: `npm run build && npm start`. A one-shot `npm run setup` runs migrate + seed + admin:create.
Local Postgres example: `createdb codecrest` or run any PostgreSQL 14+ and point `DATABASE_URL` at it.

### Administrator password
The admin password is **never stored in source code**. Put it in your local `.env` as `ADMIN_PASSWORD` and run `npm run admin:create`; it is hashed with argon2 in the database. `.env` is git-ignored. Rotate it by editing `.env` and re-running the command. Change it before going live.

## What is implemented
- **Storefront**: home, shop (filters, sort, pagination), categories, product detail, search (Postgres full-text + partial match), cart, checkout, order confirmation, order tracking, wishlist, about, contact, FAQ, shipping/returns/privacy/terms pages, sitemap, robots, JSON-LD.
- **Customers**: register, login, password reset (tokenised), profile, addresses, order history.
- **Admin portal** (`/admin`, role-checked on every page, action and API call): dashboard (live DB figures), product CRUD with variants, stock adjustments with movement history, image upload with source/licence verification, CSV export/import, categories, orders (status workflow, delivery-fee confirmation, shipments, notes, audited manual payment), payments and webhook log, suppliers and cost/margin tracking, messages, store settings, order mode, delivery zones/fees, promotions, policy pages, team/users, audit log.
- **API**: REST under `/api/v1` (see `docs/openapi.yaml`), `/api/health`.
- **Security**: argon2 password hashing, hashed server-side sessions in httpOnly cookies, lockout, rate limits, same-origin (CSRF) checks, RBAC (CUSTOMER/STAFF/ADMIN), server-side price recalculation, row-locked stock reservation, upload sniffing and re-encoding, audit log, security headers.

## Catalogue and pricing
All **125 products** come from the supplied catalogue document (`data/source/…docx` → `data/catalogue.json`). Rule applied once at import: if the base planning price is **strictly above ₦20,000**, retail = base + ₦10,000; otherwise unchanged. Money is stored as integer kobo. Base planning price, verified supplier cost and retail price are separate fields. Every product starts as **unverified planning data** — no supplier, cost, stock level or delivery promise has been invented. `npm run catalogue:verify` re-checks the database against the source.

## Honest status of integrations
| Area | State |
|---|---|
| Paystack payments | Code complete (initialise, verify with amount/currency/reference checks, HMAC-SHA512 webhook, dedupe). **Not tested against Paystack — needs `PAYSTACK_SECRET_KEY` and an approved account.** Store runs in `REQUEST` mode (order requests, no online payment) until you switch to `LIVE`. |
| Email (Resend) | Outbox implemented. Without `RESEND_API_KEY`/`EMAIL_FROM` messages are stored as `NOT_CONFIGURED`; none are sent. |
| Suppliers | Adapter interface + manual adapter. No supplier API is connected; none is pre-loaded. See `docs/SUPPLIER_INTEGRATIONS.md`. |
| Delivery | Zones/methods are admin-configured. The seeded Nigeria method has an **unconfirmed** fee shown as "to be confirmed". |
| Product images | Original Code Crest illustrations (licence: owned, verification: pending). Replace with real photos via Admin → product → Images; see `docs/IMAGE_VERIFICATION.md`. |
| Policies | Drafts with `[bracketed]` gaps. Need legal review before launch. |
| Rate limiting | In-memory (single instance). Use a shared store (Redis) if you run multiple instances. |

## Scripts
`dev`, `build`, `start`, `lint`, `typecheck`, `test` (unit + HTTP API tests; API tests skip if no server is running at `TEST_BASE_URL`, default `http://localhost:3000`), `db:generate`, `db:migrate`, `db:seed`, `admin:create`, `images:generate`, `catalogue:verify`.
Smoke scripts: `node scripts/smoke-store.mjs`, `node scripts/smoke-admin.mjs` (Playwright; need a running server and Chromium).

## Deployment
See `docs/DEPLOYMENT.md`. Output is `standalone`; any Node 20+ host with PostgreSQL works. Nothing has been deployed by this repository.

## Layout
`src/app` routes · `src/components` UI · `src/server` services, auth, db · `src/lib` shared helpers · `drizzle` migrations · `data` catalogue · `scripts` tooling · `tests` · `docs`.
