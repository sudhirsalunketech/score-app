# CrickScore product gap audit

> **Current matrix:** `docs/FINAL-PRODUCT-GAP-AUDIT.md` (17 Aug 2026, knockout/notifications/PDF/search pass). This 14 Aug file is historical. Do not treat the statuses below as current.

**Date:** 14 Aug 2026  
**Repo:** `/home/sudhir/crickscore-new` (this application — not a new app)  
**Method:** Full read of `apps/web`, `apps/api`, `packages/shared`, `prisma/schema.prisma`, existing `docs/`

This document is the source of truth for what already exists. Implementation must extend this stack. Do not create a second app, rewrite `replayInnings`, or duplicate models that already exist.

---

## Architecture found (do not replace)

| Layer | Actual stack | Not present |
|-------|--------------|-------------|
| Frontend | Vite + React 18 + TypeScript PWA (`apps/web`) | Expo / React Native |
| Routing | `react-router-dom` | Bottom tab bar |
| Navigation | Left drawer (`AppDrawer`) + `AppShell` | — |
| Data | TanStack Query, Socket.IO client, `localStorage` tokens | — |
| Backend | NestJS 10, global prefix **`/api/v1`** | Standalone Express app, unversioned `/api` |
| Realtime | Socket.IO (`RealtimeGateway`), optional Redis adapter | Client-emitted scoring events |
| DB | PostgreSQL + Prisma (33 models, 2 migrations) | — |
| Scoring | Append-only `BallEvent` → `replayInnings` in `@crickscore/shared` | Direct mutation of historical balls |
| i18n | `en` / `hi` / `mr` | — |
| Brand | Teal `#00897B`, scoring orange `#FF9800`, white bg, 44px touch | Competitor branding |

Demo: `scorer@crickscore.dev` after `pnpm db:seed` (password from `SEED_PASSWORD`)  
App: `http://localhost:5173` · API: `http://localhost:4000/api/v1` · Docs: `/api/docs`

---

## Status legend

| Status | Meaning |
|--------|---------|
| **EXISTS** | Frontend + backend + data path work for the intended job |
| **PARTIAL** | Some of UI, API, or DB exists; product-complete behaviour does not |
| **MISSING** | Not implemented; do not claim it |
| **BROKEN** | UI or API exists but does the wrong thing |

Priority: **P0** ship-blocking · **P1** important · **P2** enhancement

---

## Feature matrix

| Feature | Status | Current implementation | Gap | FE | BE | DB | API | Pri | Plan |
|---------|--------|------------------------|-----|----|----|----|-----|-----|------|
| Email/password login | EXISTS | `LoginPage`, `POST /auth/login`, bcrypt 12, JWT 15m | Polish copy/layout to CrickScore welcome screen | Y | Y | Y | Y | P0 | Restyle only |
| Register | EXISTS | `RegisterPage`, `POST /auth/register` (role SCORER) | Optional phone; no email verify | Y | Y | Y | Y | P1 | Keep |
| Refresh token rotation | EXISTS | `POST /auth/refresh`, hashed `RefreshToken` | No device metadata | Y | Y | Y | Y | P0 | Keep |
| Logout | PARTIAL | Drawer logout + `POST /auth/logout` | No confirmation | Y | Y | Y | Y | P0 | Confirm sheet |
| Forgot password | PARTIAL | `ForgotPage` + token in DB | No email send; token only logged in non-prod | Y | Y | Y | Y | P1 | Reset UI; email later |
| Reset password UI | MISSING | API `POST /auth/reset-password` exists | No `/reset` page | N | Y | Y | Y | P0 | Add page |
| Change password | MISSING | — | No endpoint or settings UI | N | N | Y | N | P0 | `POST /auth/change-password` |
| OTP / phone login | MISSING | `User.phone` only | No OTP model or SMS provider | N | N | N | N | P2 | **Do not invent** until provider exists |
| Splash / welcome | MISSING | Login subtitle only | No splash | N | — | — | — | P2 | Optional branded splash |
| Session expired UX | PARTIAL | 401 → refresh → clear tokens | No “session expired” screen | Y | Y | Y | Y | P1 | Redirect + message |
| Account deletion | MISSING | — | No API | N | N | N | N | P2 | Soft-delete later |
| Profile view | PARTIAL | `ProfilePage` name/role/avatar | Stats always “—” | Y | Y | Y | Y | P1 | Wire career stats |
| Edit profile | PARTIAL | `PATCH /users/me` (name, locale, phone) | No edit form | N | Y | Y | Y | P0 | Settings/profile form |
| Device / sessions | PARTIAL | `RefreshToken` rows | No list/revoke-other UI; no UA/IP | N | N | PARTIAL | N | P1 | List tokens; logout all; no fake location |
| Role enum | EXISTS | SUPER_ADMIN … VIEWER | Permission tables seeded but unused | — | Y | Y | Y | P0 | Keep enum; enforce |
| Resource ownership | MISSING | Writes gated by role only | Any SCORER can score any match | N | N | PARTIAL | N | P0 | Enforce `settings.scorerId` + creator |
| Playing XI | MISSING | `MatchPlayer` model unused | Squad from full team roster | N | N | Y | N | P0 | API + XI screen |
| Captain / WK flags | MISSING | Not on `MatchPlayer` | Need fields | N | N | N | N | P1 | Migration then UI |
| Create match | EXISTS | `OpenMatchPage` | Season `*` not validated; no Zod | Y | Y | Y | Y | P1 | Validation |
| Toss | EXISTS | `TossModal` + `POST /matches/:id/toss` | Not locked after LIVE for non-admin | Y | Y | Y | Y | P1 | Lock after start |
| Match settings | EXISTS | Format modal, JSON settings | Last-man / impact not fully in engine | Y | Y | Y | Y | P1 | Engine only if rules already exist |
| Scoring keypad | EXISTS | Orange keypad, extras, wicket, undo | — | Y | Y | Y | Y | P0 | Keep; do not rewrite |
| Undo | EXISTS | Soft `isUndone`, replay | Extra confirm only if needed | Y | Y | Y | Y | P0 | Keep append-only |
| Offline scoring | PARTIAL | `offline-queue.ts`, idempotency | No batch sync API; UI only on score page | Y | PARTIAL | Y | PARTIAL | P0 | Keep queue; add status globally |
| Multi-scorer | PARTIAL | Any SCORER JWT can POST events | No presence, no conflict lock | N | N | N | N | P1 | Assigned scorers + socket presence |
| Socket live | EXISTS | Server emits; viewers listen | `join.match` unauthenticated; no WS JWT | Y | Y | — | Y | P1 | Auth private rooms |
| Public live (no login) | EXISTS | `/live/match/:slug` + public APIs | — | Y | Y | Y | Y | P0 | Keep |
| YouTube / overlay | EXISTS | Embed + `/overlay` | Overlay strings hardcoded EN | Y | Y | Y | Y | P2 | i18n |
| Match centre | EXISTS | Summary + scoring pages | — | Y | Y | Y | Y | P0 | Keep |
| Scorecard | EXISTS | `ScorecardView` from replay | — | Y | Y | Y | Y | P0 | Keep |
| Ball-by-ball | EXISTS | `MatchBallsTab` from `BallEvent` | — | Y | Y | Y | Y | P0 | Keep |
| Partnerships (current) | EXISTS | Snapshot + DB current row | Historical list incomplete | Y | Y | PARTIAL | Y | P1 | Expose replay history |
| Fall of wickets | EXISTS | Replay + `FallOfWicket` | — | Y | Y | Y | Y | P0 | Keep |
| Match result / margin | MISSING | Status `COMPLETED` only | No winner, runs/wickets margin, NR | N | N | N | N | P0 | Fields + compute on complete |
| Resume match | PARTIAL | Open `/score` if innings exist | No explicit Resume CTA on lists | PARTIAL | Y | Y | Y | P0 | Resume on cards |
| Home | PARTIAL | Latest matches + tournaments | No Live / Upcoming / My / quick actions | Y | PARTIAL | Y | PARTIAL | P0 | Segment `GET /home` |
| Matches list filters | PARTIAL | Live-only via `/live-matches` | No Upcoming / Completed / My tabs | Y | N | Y | N | P0 | Client filters + query |
| Match card actions | PARTIAL | Click → centre or edit | No Score / Share / role visibility | Y | — | — | — | P0 | Actions by role |
| Search (header) | BROKEN | Icon with no handler | Dead control | Y | N | N | N | P1 | Global search API + page |
| Following | BROKEN | Lists **all** tournaments | Not a follow graph | Y | N | N | N | P2 | Hide or implement follows |
| Teams CRUD | EXISTS | List/create/detail/add player | No team stats UI, no H2H | Y | Y | Y | Y | P1 | Stats page |
| Player directory | PARTIAL | List/detail; add from team/scoring | No search-by-phone/code hub | Y | Y | Y | Y | P0 | Search + create sheet |
| Player career stats | PARTIAL | Replay API + stale `PlayerStatistic` | Profile placeholders; no year/format filters | PARTIAL | Y | Y | Y | P1 | Persist on complete |
| Player comparison | MISSING | — | — | N | N | — | N | P2 | `/players/compare` |
| Clubs | PARTIAL | List + register | No club detail, members, invites | Y | PARTIAL | PARTIAL | PARTIAL | P1 | ClubMember later |
| Tournaments | PARTIAL | List/create/detail/groups/points | No format (league/KO), schedule admin, NR column | Y | PARTIAL | PARTIAL | PARTIAL | P1 | Extend groups |
| Points table + NRR | EXISTS | `computeGroupStandings`, Points tab UI | No NR; `TournamentPoint` unused | Y | Y | PARTIAL | Y | P0 | Add NR when result exists |
| Tournament stats | PARTIAL | most runs/wickets/4s/6s | Links to global stats | Y | Y | Y | Y | P1 | Dedicated views |
| Stats hub | PARTIAL | `GET /statistics?category=` | Charts, wagon wheel missing | Y | Y | Y | Y | P1 | Charts P2 |
| Street MVP | EXISTS | `computeStreetMvp` + stats category | Super Stars screen thin | Y | Y | — | Y | P1 | Ranked Super Stars UI |
| Charts / wagon wheel | MISSING | — | — | N | N | N | N | P2 | After score persistence |
| Share | PARTIAL | Native share on live + tournament | Not on player/team; uses internal IDs in some URLs | Y | — | — | — | P1 | Slug/share URLs |
| PDF / CSV export | MISSING | — | — | N | N | — | N | P2 | Backend PDF |
| Notifications | MISSING | Prisma `Notification` unused | No feed, no push | N | N | Y | N | P2 | Do not fake |
| Dark mode | MISSING | Tokens are light | Scoring must stay high-contrast | N | — | — | — | P2 | Theme later |
| PWA service worker | MISSING | manifest only | Offline scoring uses queue, not SW cache | N | — | — | — | P2 | Optional |
| Audit log read | PARTIAL | Writes on register/match/delivery | No admin UI | N | PARTIAL | Y | N | P2 | Admin later |
| i18n coverage | PARTIAL | Most screens | Overlay, some errors hardcoded | Y | — | — | — | P1 | Keys for leftovers |
| Empty/error states | PARTIAL | Spinner / ErrorRetry / EmptyState | Players page weak; skeletons rare | Y | — | — | — | P1 | Skeletons |
| Accessibility | PARTIAL | 44px, aria on drawer/sheets | Search/news unlabeled dead buttons | Y | — | — | — | P1 | Fix dead controls |
| Integration tests | PARTIAL | Shared 35 tests; API 6 unit | No auth/scoring/e2e | — | — | — | — | P0 | Add scoring/auth tests |
| Venue CRUD | MISSING | `Venue` model + `venueText` | No venue API | N | N | Y | N | P2 | Optional |
| Season entity | MISSING | `Tournament.season` string | — | Y | Y | N | Y | P2 | Keep string |
| Knockout brackets | MISSING | Groups only | — | N | N | N | N | P2 | After league |

---

## Counts (this audit)

| Status | Count |
|--------|-------|
| EXISTS | 18 |
| PARTIAL | 28 |
| MISSING | 16 |
| BROKEN | 2 (home search icon, Following page) |

Scoring engine, public live, undo, NRR, and `/api/v1` envelope are **not** broken. Do not rebuild them.

---

## What already works (keep)

- Append-only `BallEvent` + `replayInnings` (legal balls, extras, wickets, strike, 4–8 ball overs, undo)
- JWT access + rotating refresh + bcrypt
- Public live slug, Socket.IO score push, YouTube embed, OBS overlay
- Tournament groups, add/remove team, points (W=2, T=1), NRR with all-out overs
- Offline delivery queue with idempotency keys
- Left drawer, teal/orange tokens, en/hi/mr
- Create match, toss, orange keypad, match centre, scorecard, balls tab

## Do not invent

- OTP / SMS until a provider and `Otp` model exist
- Fake notifications
- Fake device location
- Hardcoded production teams/scores
- A second scoring engine
- Bottom tabs (product uses the drawer)
- Unversioned `/api` that replaces `/api/v1`

---

## Phased plan (implementation order)

| Phase | Focus | This audit |
|-------|--------|------------|
| 1 | Repository + this document | Done |
| 2 | Auth UX + navigation roles | Next |
| 3 | Home + matches filters/actions | Next |
| 4 | Create match validation + settings lock | After 2–3 |
| 5 | Scoring UX polish only | Engine stays |
| 6 | Match centre / public live polish | Mostly EXISTS |
| 7 | Teams + player search/onboarding | P0 player add |
| 8 | Tournaments NR + schedule | After match result |
| 9 | Stats persistence + Super Stars | P1 |
| 10 | Club members + sessions | P1 |
| 11 | Offline global banner + multi-scorer | P0/P1 |
| 12 | Share slugs + PDF + notifications | P2 |
| 13 | QA matrix | Ongoing tests |

---

## Schema tables that exist but are unused (do not recreate)

`MatchPlayer`, `MatchOfficial`, `Over`, `Wicket`, `Extra`, `TournamentPoint`, `Notification`, `MatchStatistic`, `RoleDefinition` / `Permission` (seeded, unused at runtime), `Venue` (no CRUD).

Prefer wiring these over new models.
