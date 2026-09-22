# API

Base: `/api/v1`. Auth: `Authorization: Bearer <accessToken>`.  
Swagger UI: `/api/docs`.

## Envelope

```json
{ "success": true, "data": {}, "message": "Success" }
```

```json
{ "success": false, "error": { "code": "MATCH_NOT_FOUND", "message": "Match not found" } }
```

## Auth (public, rate limited)

| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/auth/register` | `{ email, password, name }` | Returns tokens + user |
| POST | `/auth/login` | `{ email, password }` | 401 `UNAUTHORIZED` |
| POST | `/auth/refresh` | `{ refreshToken }` | Rotates refresh token |
| POST | `/auth/logout` | `{ refreshToken }` | Revokes |
| POST | `/auth/forgot-password` | `{ email }` | Always `{ sent: true }` |
| POST | `/auth/reset-password` | `{ token, password }` | |

## Users

| GET/PATCH | `/users/me` | Profile; PATCH `{ name, locale, phone }` |
| POST | `/users/me/change-password` | `{ currentPassword, newPassword }` |
| GET | `/users/me/sessions` | Active sessions |
| DELETE | `/users/me/sessions/:sid` | Revoke one session |
| POST | `/users/me/logout-all` | Revoke all refresh tokens |

## Domain

| GET | `/home` | Matches (compat), plus `liveMatches`, `upcomingMatches`, `recentMatches`, `myMatches`, tournaments, profile snapshot |
| CRUD | `/teams`, `/players`, `/clubs`, `/tournaments` | RBAC on writes |
| GET | `/search?q=` | Existing matches, teams, players, tournaments (min 2 chars) |
| GET | `/players?q=&limit=` | Search by name, profile code, role, jersey |
| POST | `/players/lookup` | Auth SCORER/ADMIN/TEAM_MANAGER. Exact email/phone or name/code. Never returns PII. 20/min |
| POST | `/teams/:id/players` | `{ playerId, jerseyNo? }` — add existing player; 409 if already a member |
| POST | `/matches` | format, overs, ballsPerOver (4–8), maxWickets, ballType |
| POST | `/matches/:id/start` | → `TOSS_PENDING` |
| POST | `/matches/:id/toss` | `{ tossWinnerTeamId, tossDecision: BAT\|BOWL }` |
| POST | `/matches/:id/innings` | `{ battingTeamId, bowlingTeamId }` |
| GET | `/matches/:id/playing-xi` | Playing XI + roster |
| PUT | `/matches/:id/playing-xi` | `{ teamId, players[{ playerId, isCaptain, isViceCaptain, isWicketKeeper }], force? }` |
| GET | `/matches/:id/result` | Structured winner/margin |
| POST | `/matches/:id/pause` | `{ reason: DRINKS\|RAIN\|DELAY }` — MATCH_SCORE |
| POST | `/matches/:id/resume` | Back to LIVE — MATCH_SCORE |
| POST | `/matches/:id/complete` | `{ intent?: COMPLETE\|NO_RESULT }` — idempotent |
| POST | `/matches/:id/abandon` | Abandoned, no winner |
| POST | `/chat/:messageId/react` | `{ emoji }` — 🔥👏❤️😂🏏 toggle |
| GET | `/matches/:id/innings` | Innings list |
| GET | `/matches/:id/scorecard` | innings + snapshots |
| GET | `/matches/:id/scorecard.pdf` | Server-generated PDF (not enveloped). Same visibility as scorecard |
| GET | `/tournaments/:id/knockout` | Bracket + champion |
| POST | `/tournaments/:id/knockout/generate` | Create knockout matches with feed relationships |
| PATCH | `/tournaments/:id/knockout` | stageType / pairing / third place |
| GET | `/notifications` | In-app inbox |
| PATCH | `/notifications/:id/read` | Mark one read |
| POST | `/notifications/read-all` | Mark all read |
| POST | `/innings/:id/events` | delivery + `idempotencyKey` |
| POST | `/innings/:id/undo` | last non-undone event |
| PATCH | `/matches/:id` | includes `publicLiveEnabled`, `youtubeUrl`, `youtubeEnabled` |
| GET | `/statistics?category=` | 12 hub categories |
| GET | `/tournaments/:id/points-table` | groups + NRR |
| GET | `/tournaments/:id/rules` | JWT. Current + versions, `hasLiveOrCompletedMatches` |
| POST | `/tournaments/:id/rulesets` | Clone latest into a new version (draft, `enabled: false`) |
| PUT | `/tournaments/:id/rulesets/:version` | Replace rules if that version has no match snapshots |
| POST | `/tournaments/:id/rulesets/:version/activate` | `{ enabled }` — new matches only |
| POST | `/tournaments/:id/rules/preview` | `{ over, ball, actualRuns, isWicket?, rules? }` |
| GET | `/matches/:id/rules` | Snapshot + evaluations; full rule list only when authenticated |
| GET | `/matches/:id/rule-evaluations` | Evaluations + summary, no admin rule list |
| POST | `/tournaments/:id/groups` | `{ name }` |
| POST | `/tournaments/:id/groups/:gid/teams` | `{ teamId }` |
| DELETE | `/tournaments/:id/groups/:gid/teams/:teamId` | remove team from group |
| DELETE | `/tournaments/:id/groups/:gid` | delete group |

## Public live (no auth, `Cache-Control: no-store`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/public/matches/:slug` | Match summary; 404 if private |
| GET | `/public/matches/:slug/live` | `PublicLiveScoreDto` |

Anonymous users cannot POST events, toss, or patch matches.

## Errors

`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `USER_NOT_FOUND`, `TEAM_NOT_FOUND`, `PLAYER_NOT_FOUND`, `MATCH_NOT_FOUND`, `INVALID_MATCH_STATE`, `INVALID_DELIVERY`, `INVALID_WICKET`, `DUPLICATE_DELIVERY`.
