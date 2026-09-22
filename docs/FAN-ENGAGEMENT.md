# CrickScore Fan Engagement

Fun-only fan features: live match chat, virtual-point predictions, quizzes, badges, and leaderboards.

There is **no gambling, betting, money, or monetary reward**. Points, badges, and ranks are cosmetic.

Fan engagement is a separate system from cricket scoring.

- Cricket score: `BallEvent` → `replayInnings`
- Fan points: prediction/quiz answers → append-only `FanPointTransaction`

Do not mix these. Do not mutate `BallEvent` from fan code.

## Architecture

The feature lives inside the existing Vite + React PWA, NestJS `/api/v1`, Prisma, JWT, and Socket.IO stack.

| Layer | Location |
| --- | --- |
| Shared helpers | `packages/shared/src/fan-engagement.ts` |
| Permission | `FAN_MANAGE` on MATCH_ADMIN / TOURNAMENT_ADMIN presets |
| API | `apps/api/src/fan/` |
| Scoring hook | `ScoringService` calls `FanService.onScoringEvent` after emit (does not change replay) |
| UI | `apps/web/src/components/fans/FanZone.tsx` |
| Admin | `/matches/:id/fan/admin`, `/tournaments/:id/fan/admin` |

Default **prediction** questions are created lazily on first GET (`ensureMatchDefaults` / `ensureTournamentDefaults`). Quiz questions are created only by the tournament organizer.

## Chat

Every viewable public/live match can show chat when `chatEnabled` is true.

- Anyone may **view** chat if `publicChat` is on and the match is shareable.
- **Posting** requires login by default (`loginRequiredToChat`).
- Scoring permission is not required. Viewer, player, scorer, and admin may chat.
- Max 300 characters, HTML stripped, empty rejected, duplicate within 20s rejected.
- Rate limit: 5 messages / 10 seconds (server memory + Nest throttler).
- Blocked users cannot post. They can still view the match.
- Admins / match admins (`FAN_MANAGE`) can delete, mute (1 hour), and block.
- Normal users can report. They cannot delete other people's messages.
- System messages are generated from existing scoring events (six, 50, wicket, over, result).

Realtime events (existing Socket.IO, `emitFan` only — never `emitMatch`):

- `fan:chat:message`
- `fan:chat:deleted`
- `fan:chat:moderated`
- `fan:chat:reaction`

Replies use `ChatMessage.parentId`. Reactions are `🔥 👏 ❤️ 😂 🏏`, rate-limited (20 / 10s), and toggle per user+emoji.

## Predictions

Statuses: `DRAFT` → `OPEN` → `LOCKED` → `SETTLED` / `CANCELLED`.

Locks use **server time**. Clients cannot change timestamps or points.

Default match templates include winner, most runs, first wicket, most sixes, POTM, totals, next boundary/wicket, next batsman out, next-over questions.

- Next-ball templates are shown only while the match is live.
- `NEXT_BATSMAN_OUT` options refresh to the current striker and non-striker until the first answer is stored.
- Match winner locks when the match is LIVE / INNINGS_BREAK / COMPLETED.
- One answer per user (`FanAnswer` unique on question + user).
- Settlement is exact-match. Correct = configured points (bounded 1–50). Wrong = 0.
- Tournament templates: winner, finalists, top of group, most runs/wickets, MVP.
- Finalists settle from completed semi-final winners or the two teams in a final.
- Tournament winner settles from a completed match titled “final”.

Custom questions: tournament/match admin `POST /api/v1/fan/questions`.

## Fan Quiz

Fan Quiz is **tournament-scoped**. There is no global quiz.

Visibility uses `shouldShowFanQuiz` in `@crickscore/shared`:

1. Match exists (when opened from Match Centre)
2. Match belongs to a tournament
3. That tournament has Fan Quiz enabled
4. Quiz status is `ACTIVE`, or `SCHEDULED` (coming soon)
5. Optional start/end window still allows it

If any check fails, **do not** show a quiz icon, tab, card, notification, or empty quiz section.

`quizzesEnabled` defaults to **OFF**. A missing `FanSettings` row is treated as off.

Fan-facing APIs (`GET /matches/:id/quizzes`, `GET /matches/:id/fan/quiz`, `GET /fan/questions/:id`, answer) return empty or 404 when the tournament quiz is not visible. Correct option IDs are not sent until the question is `SETTLED`.

Organizers configure Fan Quiz on Create/Edit Tournament and manage questions at `/tournaments/:id/fan/admin`.

Match Centre shows a compact quiz icon next to Share only when `fanQuiz.show` is true. The play screen is `/matches/:id/quiz`.

- One answer per user (`FanAnswer` unique on question + user).
- Match-specific questions (`matchId` set) appear only on that match.
- Tournament-wide questions (`matchId` null) appear across the tournament’s matches.
- Default quiz templates are **not** auto-created.

## Points ledger

`FanPointTransaction` is append-only.

```
@@unique([sourceType, sourceId, userId])
```

Duplicate settlement is ignored (`P2002`). There is no `user.points +=` field.

Admins may add an `ADMIN_ADJUSTMENT` row with reason + `adminId`. They must not edit existing rows or invent a mutable balance.

## Leaderboard

Scopes are calculated separately:

- Match: transactions with that `matchId`
- Tournament: transactions with that `tournamentId`
- Global: all transactions

Rank: points → correct predictions → correct quizzes → earlier first point.

## Badges

Cosmetic awards from stats (`badgesForStats`): Hot Predictor, Prediction Master, Quiz King, Tournament Expert, Fast Thinker, Top Fan, Century Predictor, Perfect Match, Top 10 Fan.

## Settings

Tournament/match admin can toggle chat, public chat, login required, predictions, quizzes. Defaults are safe (chat on, login required to post, moderation on, percentages after lock and ≥3 answers).

## Permissions

| Actor | Chat | Predict / Quiz | Manage / moderate / settle |
| --- | --- | --- | --- |
| Guest | View if public | View | No |
| Logged-in user | Post | Answer once | No |
| Scorer | Same as user | Same as user | No (`FAN_MANAGE` is not on SCORER) |
| Match / Tournament Admin | Yes | Yes | Yes |
| Global ADMIN | Yes | Yes | Yes |

## APIs

- `GET /api/v1/matches/:id/fan`
- `GET|POST /api/v1/matches/:id/chat`
- `DELETE /api/v1/chat/:messageId`
- `POST /api/v1/chat/:messageId/report|mute|block`
- `GET /api/v1/matches/:id/predictions` · `POST /api/v1/predictions/:id/answer`
- `GET /api/v1/tournaments/:id/predictions`
- `GET /api/v1/matches/:id/quizzes` · `POST /api/v1/quizzes/:id/answer`
- `GET /api/v1/fan/questions/:id`
- `POST /api/v1/fan/questions` · `.../cancel` · `.../settle`
- `GET /api/v1/matches/:id/leaderboard` · tournaments · `/leaderboard/global`
- `GET /api/v1/users/me/fan-profile`
- `GET|PATCH /api/v1/matches/:id/fan/settings` (and tournament)

Share links: `/fan/questions/:id` → login with `?next=` if needed.

## UI

- Match Centre and Public Live: **Fans** tab (score stays first).
- Tournament: **Fans** tab + admin from More.
- Home: Fan Zone card.
- Profile: Fan tab (points, rank, accuracy, history).

i18n keys live under `fans.*` in `en` / `hi` / `mr`.

## Notifications

Prisma has a `Notification` model but no fan notification API. This feature does not invent a fake notification backend.

## Testing

Shared: sanitize, point bounds, ranking, exact answers, template visibility, badges.

API: empty/duplicate/rate-limited/blocked chat, one answer, lock enforcement, admin-only adjustments, match vs tournament leaderboard isolation.

Scorers do not receive `FAN_MANAGE`.
