# CrickScore Beta Testing

CrickScore is in a controlled beta. The goal is to let invited testers log in, receive match access, score assigned matches, and verify public live updates — without changing the scoring engine or public live architecture.

## 1. Beta purpose

Validate real invitations, JWT sessions, match permissions, append-only scoring (`BallEvent` + `replayInnings`), Socket.IO live updates, share links, rule/MVP lock, and revoke/expiry — with external testers.

Set `APP_ENV=beta` or `BETA=true`. The API exposes `GET /api/v1/config` (`beta`, `badgeOnPublic`, feature flags). A **BETA** badge appears in the authenticated app. It does **not** appear on public live pages unless `BETA_BADGE_PUBLIC=true`.

## 2. Beta users

Admin path: **Settings → Users → Beta Testers** (`/settings/testers`).

Columns: Name, Email, Role / user type, Status (`INVITED` / `ACTIVE` / `DISABLED`), Matches assigned, Last login, Actions (disable, enable, revoke invitation).

Do not create testers by sharing production passwords. Invite them.

## 3. How to invite a tester

1. Sign in as `ADMIN` or `SUPER_ADMIN`.
2. Open **Beta Testers** → **+ Invite Beta Tester**.
3. Enter name, email, user type (`PLAYER` / `SCORER` / `MATCH_ADMIN` / `VIEWER`).
4. Optionally assign a tournament and/or match.
5. **SEND INVITATION**.
6. Copy the one-time invite URL shown to the admin. The API never emails a password.

The token is 32 random bytes, stored as SHA-256, expires in 48 hours, and is invalid after accept or revoke.

Global role mapping:

- `VIEWER` → account role `VIEWER` + match access `VIEWER`
- `PLAYER` / `SCORER` / `MATCH_ADMIN` → account role `PLAYER` + the chosen match access level

A scorer is not granted a global `SCORER` role just to score one match.

## 4. How to assign match access

- Match Centre / match setup → **Access & Permissions** (`/matches/:id/access`)
- Tournament → `/tournaments/:id/access`
- Admin overview → `/access`

Grant, edit, or revoke. Expiry is optional. Revoke is immediate: the next scoring request is evaluated against current `MatchAccess` (no logout required).

## 5. Roles

Global Prisma roles: `SUPER_ADMIN`, `ADMIN`, `SCORER`, `TEAM_MANAGER`, `PLAYER`, `VIEWER`.

Match / tournament access levels: `VIEWER`, `PLAYER`, `SCORER`, `MATCH_ADMIN`, `TOURNAMENT_ADMIN`, `CUSTOM`.

## 6. Permissions

Enforced on the API with `@RequirePermission` + `AccessService.assertMatch` / `assertTournament`. Hiding a button is not authorization.

| Actor | Can | Cannot |
| --- | --- | --- |
| Beta admin | Tournaments, matches, users, access, rules, MVP, teams, players | — |
| Scorer (MATCH_SCORE) | Open assigned match, score, undo if granted, scorecard/stats/MVP, share public live | Edit tournament/MVP rules, delete match, manage users |
| Player | Login, assigned matches, profile, stats, team, scorecard, MVP | Score unless `MATCH_SCORE`, edit/delete match, change rules |
| Viewer | Assigned/public match, scorecard, stats if enabled, live | Score, undo, edit, delete, manage access |
| Public | `/live/:slug` | Any scoring or edit API (401/403) |

## 7. How to test scoring

Open an assigned live match → Score. Use 1 / 4 / 6 / extra / wicket / undo. Events are append-only `BallEvent` rows. Undo marks `isUndone` and replays; it does not mutate historical score fields.

## 8. How to test live score

Open `/live/<slug>` in a logged-out / incognito window. Score from another session. The public page must update over Socket.IO without refresh.

## 9. How to test sharing

Match Centre → Share → copy / native / WhatsApp / Telegram / QR. Open the same URL incognito. Public viewer cannot score.

## 10. How to test custom rules

Configure rules on a **beta** tournament (not a production cup). Example test-only rules (set in the rules UI, never hardcoded in the engine):

- Over 3: double runs (`MULTIPLY_RUNS`)
- Ball 4: penalty +2 (`ADD_PENALTY`)
- Wicket: −1 (`WICKET_PENALTY`)

Create Tournament A and Tournament B with different rules. Scoring must follow each tournament’s snapshot independently.

## 11. How to test MVP

Set batting/bowling/fielding points before the match starts. After the match is live, MVP rules lock. The edit control is hidden and the API rejects changes. The match uses the locked snapshot.

## 12. How to revoke access

Revoke `MATCH_SCORE` on the access screen, then immediately `POST /api/v1/innings/:id/events` with the same JWT. Expected: **403** `"You don't have permission to score this match."`

Expired access: leave the row in place with status `EXPIRED`. Expected: **403** `"Your match access has expired."`

## 13. Known limitations

- There is no outbound email/SMS. Admins copy the invite URL.
- `prisma/seed.ts` **wipes** the database. Never run it against production.
- Additive fixtures: `SEED_BETA=1 SEED_PASSWORD=… pnpm db:seed-beta` (refuses production unless `ALLOW_BETA_SEED=1`).
- Access-request workflow from earlier product notes is not part of this beta.
- Lint is not configured at the workspace root.

## 14. Deployment instructions

Existing stack: Docker Compose (postgres, redis, api, web/nginx). Do not introduce a new platform.

1. Copy `.env.example` → `.env`. Set real `JWT_*` secrets, `DATABASE_URL`, `WEB_ORIGIN`, `APP_ENV=beta`.
2. `pnpm db:generate` and `pnpm db:migrate` (forward only). Never `migrate reset` on shared data.
3. `docker compose up --build` (or the host’s existing PM2/systemd unit if that is already how this repo is deployed).
4. Health: `GET /api/v1/health` → `{ "status": "ok", "ok": true, "name": "CrickScore API" }`.
5. Confirm nginx proxies `/api/` and `/socket.io/` to the API. Frontend production builds should use `VITE_API_URL=same-origin` when web and API share a host.

## 15. Rollback instructions

1. Redeploy the previous API and web images / `dist` folders.
2. Do **not** roll back applied Prisma migrations on a live database. The beta migration only adds nullable/default columns and `BetaFeedback`.
3. Disable testers from **Beta Testers** or set `BETA=false` / `APP_ENV=production` to hide the badge and feedback entry. Existing access rows remain.

## 16. Smoke test checklist

1. Open application  
2. Login  
3. Open assigned match  
4. Start/resume scoring  
5. Score 1  
6. Score 4  
7. Score 6  
8. Add extra  
9. Add wicket  
10. Undo  
11. Verify scorecard  
12. Verify stats  
13. Verify MVP  
14. Open public live link  
15. Verify Socket.IO update  
16. Share link  
17. Logout  
18. Login as viewer  
19. Verify viewer cannot score  
20. Login as player  
21. Verify player permissions  
22. Revoke access  
23. Verify access denied  

## Admin beta checklist

- [ ] User invited  
- [ ] User accepted  
- [ ] User login works  
- [ ] Match access granted  
- [ ] Permission correct  
- [ ] Scoring works  
- [ ] Undo works  
- [ ] Public live works  
- [ ] Socket updates work  
- [ ] Share works  
- [ ] Rules locked  
- [ ] MVP rules locked  
- [ ] Match result works  
- [ ] Access revoke works  
- [ ] Expiry works  
- [ ] Viewer restrictions work  

## Beta test scenario (documented only)

Use a dedicated tournament **CrickScore Beta Cup**, match **Alpha XI vs Raghus Challengers**, 5 overs / 7 wickets. Custom rules above are **test configuration**, not engine defaults.

Optional local accounts (only via `SEED_PASSWORD`, never committed):

- `beta-admin@example.com`
- `beta-scorer@example.com`
- `beta-player@example.com`
- `beta-viewer@example.com`

## API checks (not UI-only)

| Caller | Request | Expected |
| --- | --- | --- |
| Viewer | `POST /api/v1/innings/:id/events` | 403 |
| Player without MATCH_SCORE | scoring POST | 403 |
| Scorer with MATCH_SCORE | scoring POST | 200/201 |
| Scorer without MATCH_EDIT | `PATCH /api/v1/matches/:id` | 403 |
| Match admin | `PATCH /api/v1/matches/:id` | success |
| Non-admin | `DELETE /api/v1/matches/:id` | 403 |
| Public | scoring POST | 401/403 |

Direct URL to an unassigned match must fail on the API (`This match is no longer available.` / 403), not only in the UI.

## Environment variables

See `.env.example`. Never commit JWT secrets, database passwords, SMTP credentials, invitation tokens, or real beta passwords.

## Feature flags

`GET /api/v1/config` reports: `PLAYER_LOGIN`, `MATCH_ACCESS`, `CUSTOM_RULES`, `CUSTOM_MVP`, `PUBLIC_SHARE`, `BETA_FEEDBACK` (feedback only when `APP_ENV=beta` or `BETA=true`).
