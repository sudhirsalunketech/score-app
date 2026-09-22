# Live Match

Anonymous viewers watch a live score at:

```text
/live/match/{publicSlug}
```

Example: `/live/match/ye-vs-mestry-xi-2026`

The scorer phone is the only writer. Viewers are read-only.

```text
SCORER
  POST /api/v1/innings/:id/events   (JWT + SCORER/ADMIN)
  → BallEvent stored, innings replayed
  → Socket.IO  match.score.updated  (PublicLiveScoreDto)
PUBLIC PAGE
  GET  /api/v1/public/matches/:slug/live   (no auth, Cache-Control: no-store)
  join.public-match {slug}  → room match:{matchId}
```

## Public live toggle

`Match.publicLiveEnabled` must be `true`. When off, public REST returns 404 and Socket.IO `join.public-match` is denied.

A stable `publicSlug` is generated on match create (`alpha-xi-vs-bhavin-2026`).

## Socket rooms

| Client | Join event | Allowed when |
|--------|------------|--------------|
| Scorer | `join.match` + matchId | Authenticated JWT on the handshake |
| Viewer | `join.public-match` + slug | `publicLiveEnabled === true` |

Scoring is never accepted over Socket.IO. Writes stay on HTTP.

Rooms: `match:{matchId}`. Redis adapter is used when `REDIS_URL` is set (multiple API instances).

## Events

- `match.score.updated` — authoritative `PublicLiveScoreDto`
- `delivery.created` — same DTO (scorer invalidation)
- `innings.completed` / `match.completed`
- `match.join.denied` — private match

## Fallback

If the socket drops, the public page shows **Reconnecting** and polls `GET /public/matches/:slug/live` every 5 seconds. Polling stops on reconnect. Duplicate flashes are ignored via last ball `sequence`.

## YouTube

Store **video id only**. URLs are validated in `@crickscore/shared` (`extractYoutubeVideoId`). Embed:

```text
https://www.youtube.com/embed/{id}
```

The iframe displays the stream. It does **not** draw the CrickScore score onto YouTube. For a score burned into the broadcast, use the OBS overlay.

## OBS overlay

`/live/match/{slug}/overlay` — transparent page, no chrome. See `docs/YOUTUBE-OBS-OVERLAY.md`.

## Share

On Open Match (after save) and Match Centre: copy link, WhatsApp, native share, QR code.
