# Stats

## Hub

`GET /api/v1/statistics?category=` — replay-based categories including most runs, wickets, and street MVP (`computeStreetMvp`).

Formula (do not swap for fantasy points): see `docs/MVP-FORMULA.md`.

Live leaderboards continue to derive from `BallEvent` + `replayInnings`.

## Persistence

On first match completion (and abandon / no-result), `StatsPersistenceService` writes:

- `MatchStatistic.payload` — idempotency lock + historical snapshot of player/team deltas
- `PlayerStatistic` — career batting/bowling/fielding totals
- `TeamStatistic` — matches, wins, losses, ties, no-results, runs, wickets

Completing the same match twice does not double totals. Undo of a completed match reverses additive career fields and deletes the snapshot.

Tournament points and NRR stay computed by `computeGroupStandings` from stored match results. `TournamentPoint` rows are unused.

## Player / team

- `GET /api/v1/players/:id/statistics` — live replay plus persisted `PlayerStatistic`
- `GET /api/v1/teams/:id/statistics` — reads `TeamStatistic`

## Gaps

- No comparison endpoints
- No year / format / ball-type filters on API
- No wagon wheel
- Highest score / best bowling are high-watermarks and are not fully restored on undo
