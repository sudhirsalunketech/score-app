# Tournaments

## What exists

- CRUD-lite: list, create, get
- Groups: create, add/remove team, delete group
- Points: `GET /api/v1/tournaments/:id/points-table`
- Standings: `computeGroupStandings` in `@crickscore/shared`
  - Win = 2 pts, tie = 1
  - NRR = (runs/overs faced) − (runs conceded/overs bowled)
  - All-out innings count as full allotted overs **per innings**
  - Only matches where **both** teams are in the group
- UI: tournament detail tabs Home / Teams / Matches / Points / Statistics
- Custom rules: Tournament → More → Custom Rules (`/tournaments/:id/rules`). Optional, versioned, snapshotted onto matches. See `TOURNAMENT-RULES.md`.
- Points UI: group pills (Add Team / Remove / Share), M W L T P NRR, CREATE GROUP

## Knockout

Optional `stageType`: `GROUP_STAGE` | `KNOCKOUT` | `GROUP_AND_KNOCKOUT`.

`POST /api/v1/tournaments/:id/knockout/generate` creates real `Match` rows with `knockoutRound`, `knockoutSlot`, and `feedsIntoMatchId` / `feedsIntoSide`. When a knockout match completes, the winner is written onto the next match. Completing the Final sets `Tournament.championTeamId`, `runnerUpTeamId`, and `lifecycle = COMPLETED`.

UI: Tournament → Knockout tab.

## Gaps

- No automatic group-stage fixture generator (round-robin still created as individual matches)
- `season` is a string, not a Season entity

## Do not

Recreate NRR. Extend `computeGroupStandings` when match-level NR/abandoned exists.
