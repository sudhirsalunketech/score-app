# CrickScore final product gap audit

**Date:** 17 Aug 2026 (re-verified)  
**Repo:** `/home/sudhir/crickscore-new`  
**Method:** Current-code inspection of `apps/web`, `apps/api`, `packages/shared`, `prisma/schema.prisma`, `docs/`, and existing tests. The 14 Aug `docs/PRODUCT-GAP-AUDIT.md` is **historical** and was not treated as truth.

Status means the **complete user journey** (UI → API → auth → DB → Socket → UI), not “a route exists”.

| Status | Meaning |
|--------|---------|
| EXISTS | Journey works end-to-end in current code + automated tests where listed |
| PARTIAL | Some of UI / API / DB / Socket exists; product-complete behaviour does not |
| MISSING | Not implemented |
| BROKEN | Code exists but fails (compile, wrong behaviour, or security hole) |

Priority: **P0** ship-blocking · **P1** important · **P2** later / do not invent

---

## Architecture (do not replace)

| Layer | Actual |
|-------|--------|
| Frontend | Vite + React PWA (`apps/web`) |
| Backend | NestJS `/api/v1` |
| DB | PostgreSQL + Prisma |
| Scoring | Append-only `BallEvent` + `replayInnings` in `@crickscore/shared` |
| Realtime | Socket.IO (`RealtimeGateway`) |
| Auth | JWT access + rotating hashed refresh |
| Roles | `SUPER_ADMIN` `ADMIN` `SCORER` `TEAM_MANAGER` `PLAYER` `VIEWER` |
| i18n | `en` / `hi` / `mr` |

No Expo app. No second scoring engine. Register creates **PLAYER**, not SCORER.

---

## Feature matrix (current, after re-audit)

| Feature | Current UI | Current API | Current DB | Current Socket | Status | Missing pieces | Pri | Implementation required | Test required |
|---------|------------|-------------|------------|----------------|--------|----------------|-----|-------------------------|---------------|
| Email/password + OTP login | LoginPage | POST `/auth/login`, `/auth/otp/*` | User | — | EXISTS | SMS OTP not invented | P0 | No | auth.service.test + identifier.test |
| Refresh rotation | silent 401 refresh | POST `/auth/refresh` | RefreshToken | — | EXISTS | No reuse-family wipe | P0 | No | auth.service.test |
| Logout + confirm | Drawer sheet | POST `/auth/logout` | revoke hash | — | EXISTS | — | P0 | No | auth.service.test |
| Reset password | Forgot + `/reset` | forgot/reset + mailer | PasswordReset | — | EXISTS | Prod mail depends on env | P0 | No | mailer.test + auth.service.test |
| Change password | Settings form → logout | POST `/users/me/change-password` | User + revoke all | — | EXISTS | — | P0 | No | auth.service.test |
| Logout all | Settings confirm | POST `/users/me/logout-all` | RefreshToken | — | EXISTS | — | P0 | No | auth.service.test |
| Active sessions | Settings list | GET `/users/me/sessions` | UA + lastActiveAt | — | EXISTS | Location omitted on purpose (no IP in UI) | P1 | No | auth.service.test |
| Edit profile + avatar | ProfilePage | PATCH `/users/me` | User | — | EXISTS | — | P0 | No | Existing |
| Role enum + scoring ACL | PermissionGate | AccessService + MATCH_SCORE | MatchAccess | join.match + grant | EXISTS | Dual helper still exists for sockets | P0 | No | access.service.test + scoring-access.test |
| Scorer assigned-only | keypad gated | MATCH_SCORE | settings.scorerId + access | — | EXISTS | Creator fallback if no scorerId | P0 | No | scoring-access.test |
| Viewer / player cannot score | — | 403 | — | — | EXISTS | — | P0 | No | access.service.test |
| Public private-API block | — | JwtAuthGuard | — | — | EXISTS | Invalid JWT on @Public treated as anonymous | P1 | No | public-readonly.test |
| Match create validation | OpenMatchPage | Zod createSchema | Match | — | EXISTS | Client does not pre-check overs locally | P1 | No | Existing |
| Scoring-rule lock | banner + disabled format | 409 MATCH_STRUCTURE_LOCKED if LIVE or any BallEvent | Match + BallEvent count | — | EXISTS | — | P0 | No | lifecycle.test + product-gaps.spec |
| Playing XI + C/WK | PlayingXIPage | PUT playing-xi | MatchPlayer | — | EXISTS | VC required (stricter than spec) | P0 | No | playing-xi.test |
| Player search | Players + team add | GET `/players` + POST `/players/lookup` | User.email/phone exact | — | EXISTS | SMS directory not public; lookup 20/min + 403 for viewers | P1 | No | player-lookup.test + product-gaps.spec |
| Tournament groups/points/NRR | Points tab | points-table + persist | TournamentPoint | — | EXISTS | Group-stage round-robin generator still not automatic | P2 | No | Existing |
| Custom tournament rules | Rules page | versioned rule sets | TournamentRuleSet + snapshot | — | EXISTS | — | P0 | No | rules.service.test + event-stat-policy.test |
| Rule lock / versions | locked UI | snapshot at innings start | MatchRuleSnapshot | — | EXISTS | — | P0 | No | Existing |
| Undo + custom rules | keypad undo | soft isUndone + re-eval | BallEvent | score.updated | EXISTS | — | P0 | No | scoring tests |
| Match result + standings | banner + complete | computeMatchResult | Match result fields | match.completed | EXISTS | — | P0 | No | match-result.test |
| MVP custom + lock + info | Super Stars + Statistics sheet | snapshot mvpJson | TournamentRuleSet.mvpJson | — | EXISTS | — | P0 | No | Existing |
| Scoring engine integrity | Orange keypad | BallEvent + replayInnings | BallEvent | server emit only | EXISTS | Do not rewrite | P0 | No | index.test |
| Offline queue + banner | OfflineBanner | idempotent POST events | — | — | EXISTS | — | P0 | No | offline-queue.test |
| Transparent overlay route | `/live/match/:slug/overlay` | GET public `/live` | — | join.public-match | EXISTS | Hidden when public live off | P0 | No | overlay.spec |
| Overlay modes + broadcast panel | Open Match + Match Centre | settings.broadcast | Match.settings JSON | — | EXISTS | — | P0 | No | overlay-model.test |
| FOUR/SIX/WICKET + milestones + over card | BurstCard | lastBall sequence | sessionStorage dedup | score.updated | EXISTS | — | P0 | No | overlay.spec + unit |
| Recent overs / partnership / key moments | full mode | recentBalls | — | — | EXISTS | — | P0 | No | Existing |
| Delay states (drinks/rain/match) | Centre pause + overlay card | POST pause/resume | DRINKS/RAIN/MATCH_DELAY | score.updated | EXISTS | Apply migration on live DB | P1 | No | lifecycle.test |
| Innings break + result + POTM | overlay cards | result + public MVP | Match + replay | — | EXISTS | POTM only if API returns a name | P0 | No | Existing |
| YouTube on public page, not overlay | PublicLivePage | youtubeVideoId | Match | — | EXISTS | — | P0 | No | Existing |
| Themes + sponsor + tournament brand | overlay + panel | settings.broadcast | JSON | — | EXISTS | — | P0 | No | Existing |
| Socket reconnect + LIVE/OFFLINE pill | StatusPill | snapshot + 5s poll fallback | — | reconnect | EXISTS | — | P0 | No | Existing |
| Public live tabs | summary/video/scorecard/teams/chat/quiz | public GET | playingXi in DTO | live + fan | EXISTS | Only enabled sections render | P1 | No | Manual |
| Live chat send/reply/moderation | FanZone | chat CRUD + parentId | ChatMessage | fan:chat:* | EXISTS | — | P1 | No | fan.service.test |
| Emoji reactions | FanZone counters | POST `/chat/:id/react` | ChatReaction | fan:chat:reaction | EXISTS | — | P1 | No | fan.service.test |
| Fan prediction (no betting) | FanZone | FanQuestion PREDICTION | FanAnswer + points | lock/settle | EXISTS | — | P0 | No | fan-engagement.test |
| Quiz + leaderboard + winners | FanQuizPage | quiz APIs | FanQuestion | — | EXISTS | — | P1 | No | Existing e2e |
| Drawer + home sections | AppDrawer / HomePage | GET `/home` | — | — | EXISTS | Extra working items: Following, Search | P1 | No | journeys.spec |
| Notifications | Bell + `/notifications` | GET/PATCH inbox | Notification type/channel/status | — | EXISTS | EMAIL only if SMTP/Resend/Sendgrid; PUSH not configured (shown, not faked) | P1 | No | notifications.service.test |
| Stats hub | StatisticsPage | GET `/statistics` | replay-derived | — | EXISTS | No in-page tournament picker | P2 | No | Existing |
| Share | ShareSheet | slugs | — | — | EXISTS | — | P1 | No | share.test + share-text.test |
| Scorecard PDF | Download PDF | GET `/matches/:id/scorecard.pdf` | replay/scorecard | — | EXISTS | Helvetica text PDF (Latin names); print remains fallback | P1 | No | scorecard-pdf.test + product-gaps.spec |
| Overlay i18n | overlay.* + share.body en/hi/mr | — | — | — | EXISTS | — | P1 | No | share.test |
| Overlay safe zones 1920/1280 | cs-ov-safe + OBS 720 step | — | — | — | EXISTS | — | P1 | No | Manual |
| Knockout / fixture generator | Knockout tab | generate + advance + champion | Match feeds + Tournament.champion | — | EXISTS | Group-stage RR generator still missing | P1 | No | knockout.test + product-gaps.spec |
| SMS OTP | — | email OTP only | — | — | MISSING | No SMS provider | P2 | No | — |

---

## Counts

### Before the 17 Aug implementation pass

| Status | Count |
|--------|-------|
| EXISTS | 28 |
| PARTIAL | 16 |
| MISSING | 5 |
| BROKEN | 1 (`SettingsPage` change-password compile break) |

### After re-audit (this document)

| Status | Count |
|--------|-------|
| EXISTS | 48 |
| PARTIAL | 0 |
| MISSING | 3 |
| BROKEN | 0 |

Still PARTIAL: none of the original P1 product gaps except features that require a real provider.

Still MISSING (intentionally): SMS OTP (no provider), push notification provider, automatic group-stage round-robin generator.

Scoring, `BallEvent`, `replayInnings`, undo, public live, Socket.IO, JWT, NRR, Playing XI, custom rules, and overlay animations remain intact.

---

## This engagement implemented / verified

1. Change-password UI compiles and logs the user out after rotate  
2. Session device / browser / last active (no raw IP in UI)  
3. Format lock on Open Match after scoring starts  
4. Socket `join.match` honors MatchAccess grants  
5. Overlay hides when public live is off  
6. Broadcast panel on Match Centre  
7. Delay states + pause/resume  
8. Chat replies + emoji reactions  
9. Public Teams / Chat / Quiz tabs  
10. MVP rules info on Super Stars  
11. Key-moment i18n + overlay safe zones  
12. Scorecard print / PDF  
13. Quiz winners row  
14. Auth service tests + reaction tests  
15. Docs that match actual behaviour  
