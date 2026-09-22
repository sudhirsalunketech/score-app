# Deployment

1. Copy `.env.example` to `.env`. Set real JWT secrets, `DATABASE_URL`, `WEB_ORIGIN`, and `APP_ENV` (`development` / `beta` / `production`). Never commit secrets.
2. `docker compose up --build` starts postgres, redis, API, and the nginx-hosted web app.
3. Run `pnpm db:migrate` (forward only). `prisma/seed.ts` wipes data — never run it on production. Optional additive fixtures: `SEED_BETA=1 SEED_PASSWORD=… pnpm db:seed-beta`.
4. Put TLS in front of nginx. `WEB_ORIGIN` must list the real web origin(s).
5. Helmet, CORS, throttling, and hashed refresh tokens are on by default.
6. nginx (`docker/nginx.conf`) proxies `/api/` and `/socket.io/` to the API so public live Socket.IO works on the same host. Build the web image with `VITE_API_URL=same-origin`.

Health: `GET /api/v1/health` → `{ "status": "ok", "ok": true, "name": "CrickScore API" }`.  
Public config: `GET /api/v1/config`.

Rollback: redeploy the previous images. Do not revert applied migrations on a live database.

Beta runbook: [BETA-TESTING.md](./BETA-TESTING.md).
