# Deployment notes

Nothing is deployed by this repo. To go live:

1. Provision PostgreSQL 14+ (managed or self-hosted) with backups and TLS.
2. Set environment variables from `.env.example` on the host. Generate `SESSION_SECRET` (`openssl rand -base64 48`). Set `APP_URL` to the public https URL.
3. `npm ci && npm run build`, then `npm run db:migrate && npm run db:seed && npm run admin:create`, then `npm start` (or run `.next/standalone/server.js`) behind an HTTPS reverse proxy that sets `X-Forwarded-Host`/`X-Forwarded-Proto`.
4. Persist `UPLOAD_DIR` (default `./storage/uploads`) on a volume or move uploads to object storage.
5. Payments: add Paystack keys, register the webhook `https://<domain>/api/v1/payments/webhooks/paystack`, run a Paystack **test-mode** order end to end, then switch order mode to LIVE in Admin → Store settings.
6. Email: verify a sending domain in Resend, set `RESEND_API_KEY` and `EMAIL_FROM`.
7. Before launch: confirm delivery fees, review policy pages with a lawyer, replace the owner-supplied board images with cleared product photos and add images for the 37 products that have none, verify supplier costs, change the admin password, and use a multi-instance-safe rate limiter if scaling out.
