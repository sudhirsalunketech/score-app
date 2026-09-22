# Live scoring

Authoritative path:

```
Scorer POST /api/v1/innings/:id/events
  → BallEvent append (idempotencyKey)
  → replayInnings
  → persist innings projections + FoW + current partnership
  → Socket.IO emit match.score.updated / delivery.created
  → viewers
```

Viewers never POST events. Public join: `join.public-match` only if `publicLiveEnabled`.

## HTTP

| Path | Auth |
|------|------|
| GET `/api/v1/matches/:id/live` | Public |
| GET `/api/v1/public/matches/:slug/live` | Public, 404 if private |
| GET `/api/v1/public/matches/:slug` | Public summary |
| POST `/api/v1/innings/:id/events` | JWT + SCORER/ADMIN |
| POST `/api/v1/innings/:id/undo` | JWT + SCORER/ADMIN |
| GET `/api/v1/matches/:id/scorecard.pdf` | Same visibility as scorecard; raw PDF |

## Socket rooms

- `match:{matchId}`
- Events: `LIVE_SOCKET` in `@crickscore/shared` (`join.match`, `join.public-match`, `delivery.created`, `match.score.updated`, `innings.completed`, `match.completed`)

## Offline

Web queues deliveries in `localStorage` (`cs.offline-queue`) and flushes when online. Server returns `{ duplicate: true }` for the same `idempotencyKey` instead of inserting twice.

## Frontend

- Scorer: `/matches/:id/score` (`MatchCentrePage`) — auth required
- Viewer: `/matches/:id/centre`
- Public: `/live/match/:slug` — **no login**
- Overlay: `/live/match/:slug/overlay`

Do not change the join/emit protocol without a compatibility layer.
