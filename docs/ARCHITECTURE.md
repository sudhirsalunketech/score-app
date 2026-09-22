# Architecture

New application. Layers:

```
React PWA (apps/web)
    HTTP /api/v1 + Socket.IO
NestJS (apps/api)
    Controller → Application service → Domain (shared replay) → Prisma repository → PostgreSQL
Redis (optional cache / Socket.IO adapter when `REDIS_URL` is set)
```

## Principles

- Controllers do not contain cricket rules.
- Authoritative score = replay of `BallEvent` rows (`isUndone = false`).
- Match status transitions are validated on the server (`domain/lifecycle.ts`).
- JWT access (15m) + hashed refresh tokens (7d). Passwords bcrypt (12 rounds).
- RBAC: `SUPER_ADMIN`, `ADMIN`, `SCORER`, `TEAM_MANAGER`, `PLAYER`, `VIEWER`. Frontend hiding is not security.
- Envelope: `{ success, data, message }` / `{ success: false, error: { code, message } }`.

## Frontend

Mobile-first (360–430px) with left drawer. TanStack Query for server state. Offline queue in `apps/web/src/lib/offline-queue.ts` retries deliveries with the same idempotency key.

## Realtime

Socket.IO rooms `match:{id}`.

Scorer (JWT on handshake): `join.match`.
Anonymous viewer: `join.public-match` only when `Match.publicLiveEnabled`.

Events: `match.started`, `delivery.created`, `score.updated`, `match.score.updated` (`PublicLiveScoreDto`), `innings.completed`, `match.completed`, plus fan `fan:chat:message` / `fan:chat:reaction` / `fan:chat:deleted`.

`join.match` is allowed for JWT users who can view the match **or** hold an active `MatchAccess` grant.

Writes are HTTP-only (`POST /innings/:id/events`). See `docs/LIVE-MATCH.md`.

## Packages

- `shared` — replay, NRR, street MVP, design tokens (unit tested)
- `ui` / `types` / `config` — tokens, DTO types, env schema
