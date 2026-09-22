# CrickScore

Street-cricket scoring app (CricHeroes-style) rebuilt as a **new** NestJS + React/Vite monorepo.

Visual source of truth: [`reference/ui-screenshots/`](reference/ui-screenshots/INDEX.md) (56 captures).

## Stack

| Layer | Tech |
|-------|------|
| Web | React, TypeScript, Vite, Tailwind, TanStack Query, React Hook Form, Zod |
| API | NestJS, Prisma, PostgreSQL, Redis, Socket.IO, JWT, Swagger |
| Scoring | Append-only `BallEvent` + deterministic replay in `@crickscore/shared` |
| i18n | English, Hindi, Marathi |

## Quick start

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres redis
pnpm db:migrate
pnpm db:seed
pnpm --filter @crickscore/shared build
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:4000/api/v1
- Swagger: http://localhost:4000/api/docs

Demo login after `pnpm db:seed`: `scorer@crickscore.dev` with `SEED_PASSWORD` (local default only when that env var is unset). Never use seed accounts in production.

After seed, a public live page is at:

http://localhost:5173/live/match/ye-vs-mestry-xi-2026

Enable **Public Live Score** on Open Match to share a slug URL, QR, and YouTube embed. OBS overlay: `/live/match/{slug}/overlay` — see `docs/LIVE-MATCH.md` and `docs/YOUTUBE-OBS-OVERLAY.md`.

## Docker (full stack)

```bash
docker compose up --build
```

Postgres is published on **5435** so it does not clash with other local databases.

## Workspace

```
apps/web          Mobile-first PWA UI (left drawer, orange keypad)
apps/api          NestJS /api/v1
packages/shared   Replay engine, NRR, street MVP, design tokens
packages/ui       Token re-exports
packages/types    Shared types
packages/config   Env schema
prisma/           Schema, migrations, seed
docs/             Architecture and product docs
```

Do not modify `/home/sudhir/esp/crickscore`. This application is independent.
# score-app
