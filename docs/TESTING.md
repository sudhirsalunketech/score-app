# Testing

```bash
pnpm --filter @crickscore/shared test
pnpm --filter @crickscore/api test
```

## Unit (shared)

Scoring, extras, wickets, strike rotation, undo, NRR (all-out uses full allotted overs), street MVP.

## Integration (API)

Auth register/login/refresh, team/player CRUD, match → toss → innings → event idempotency → undo → scorecard. Run against PostgreSQL after `pnpm db:migrate`.

Auth service (mocked Prisma): `apps/api/src/auth/auth.service.test.ts` — login, invalid login, disabled account, refresh, expired refresh, logout, logout-all, change-password, reset-password, session device/browser (no IP leak).

Scorer assignment: `apps/api/src/matches/scoring-access.test.ts` (assigned scorer vs other scorer vs admin vs viewer).

Fan chat reactions: `apps/api/src/fan/fan.service.test.ts` — toggle emoji, reject unsupported emoji, rate-limit.

Playwright: `apps/web/e2e/` (workers=1, `x-e2e: 1` skips auth rate limits outside production). Gap coverage: `product-gaps.spec.ts`, `live-viewers.spec.ts`, `full-match.spec.ts`, `overlay.spec.ts`.

## E2E journey

Register → login → create team → add players → create match (T10, 5 overs, 7 wickets, tennis) → toss → start innings → score balls → wicket → complete → scorecard → statistics.

## Public live

YouTube URL extraction, public slug, `canJoinLiveRoom`, `PublicLiveScoreDto` mapping: `packages/shared/src/public-live.test.ts` and `apps/api/src/public-live/public-live.test.ts`.

Manual E2E: scorer scores a ball → `BallEvent` row → `match.score.updated` → public `/live/match/{slug}` updates without refresh. Overlay: `docs/YOUTUBE-OBS-OVERLAY.md`.

## Visual QA

Compare Home, Drawer, Open Match, Toss, Orange keypad, Wicket sheet, Scorecard, Statistics hub, Tournament points against `reference/ui-screenshots/` at 390px width.
