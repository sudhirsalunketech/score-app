# MVP formula (Points System)

Street cricket MVP. This is **not** a fantasy-points league. Super Stars and the tournament MVP leaderboard use the same engine.

```
BallEvent (actual cricket)
        ↓
replayInnings          ← never rewritten for MVP
        ↓
Match rule snapshot    ← locked MVP table (or default if none)
        ↓
MVP engine             ← actual bat / bowl / field stats
        ↓
Match Super Stars + tournament MVP leaderboard
```

Custom score multipliers (over ×2, ignore runs, etc.) do **not** inflate batting MVP. Player career stats stay actual cricket.

## Default table

Matches the in-app Points System modal.

| Area | Rule | Points |
|------|------|--------|
| Batting | Runs / 10, only if runs ≥ 10 | 1 per 10 runs (**not floored**: 198 → 19.8) |
| Batting | 50+ | +1 |
| Batting | 100+ | +1 |
| Batting | Strike rate ≥ 130, min **10 runs** (balls faced > 0) | +1 |
| Bowling | Each wicket | 2 |
| Bowling | 3 wickets | +1 |
| Bowling | 5 wickets | +1 |
| Fielding | Catch / stumping / run out | 1 each |

Totals are rounded to 1 decimal. Example: 198 runs off 100 balls (SR 198), 7 wickets, 5 catches → Bat 22.8, Bowl 16.0, Field 5.0, total 43.8. Same innings off 200 balls (no SR bonus) is Bat 21.8.

## Snapshot / lock

`MvpConfig` lives on `TournamentRuleSet.mvpJson` and is copied into `MatchRuleSnapshot.rulesJson.mvp` when the match is snapshotted (innings start).

- Standalone matches, or tournaments with no rule set: `DEFAULT_MVP_CONFIG`.
- Custom scoring can be OFF and MVP can still be snapshotted from the latest rule version.
- Editing the tournament table later does not change live or completed matches.
- Tournament MVP leaderboard **sums per-match MVP** (each match uses its own locked table), not one career-then-formula pass.

Implemented as `computeStreetMvp` / `computeMatchMvp` in `@crickscore/shared`.
