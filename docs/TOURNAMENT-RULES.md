# Tournament custom rules

Optional, tournament-scoped scoring adjustments. Default matches and standalone games are unchanged.

## Architecture

```
Tournament Rules (version N, including MVP table)
        ↓
Match Snapshot  →  LOCK
        ↓
BallEvent (append-only, actual cricket)
        ↓
replayInnings          ← never rewritten for tournament rules or MVP
        ↓
┌─────────────────────┐
│ Custom score engine │  ← only if the snapshot has scoring rules enabled
│ MVP engine          │  ← actual player bat/bowl/field + snapshotted MvpConfig
└─────────────────────┘
        ↓
Match result + tournament NRR + points + player stats + MVP
```

When `customRules.enabled = false` (or the match has no `MatchRuleSnapshot`):

- `replayInnings` is the score
- no evaluations are stored
- no custom-rule UI is shown

Rules are **never** JavaScript, SQL, or free-form expressions. Conditions and actions are whitelisted enums in `@crickscore/shared`.

## Rule scopes

`TOURNAMENT` → `MATCH` → `INNINGS` → `OVER` → `BALL`

Product configuration is at **tournament** level. Starting a match snapshots the active tournament rule set onto that match.

## Conditions

`ALWAYS`, `OVER_EQUALS`, `OVER_RANGE`, `BALL_EQUALS`, `BALL_RANGE`, `RUNS_EQUALS`, `RUNS_GREATER_THAN`, `RUNS_LESS_THAN`, `WICKET`, `EXTRA`, `DOT_BALL`, `BOUNDARY`, `SIX`, `TARGET_COMPLETED`, `TARGET_FAILED`

Over and ball numbers in the engine are **1-based** (Over 3 = 3). `BallEvent.overNumber` / `ballInOver` stay 0-based; the API adds 1 only when evaluating.

## Actions

`COUNT_NORMAL`, `IGNORE_RUNS`, `MULTIPLY_RUNS` (0× / 1× / 2× / 3×), `ADD_RUNS`, `SUBTRACT_RUNS`, `ADD_PENALTY`, `SUBTRACT_PENALTY`, `WICKET_BONUS`, `WICKET_PENALTY`, `DO_NOT_COUNT_OVER`, `MARK_TARGET_COMPLETE`, `MARK_TARGET_FAILED`

Run deltas are clamped to ±50.

## Priority / conflict resolution

Enabled rules are sorted:

1. Specificity: ball (40) > over (30) > innings (20) > tournament (10)
2. Then higher `priority`
3. Then rule id

Rules apply **in that order**, so a later (more specific / higher priority) rule can override an earlier one. Example: Over 3 ×2 then Ball 2 −2 on a 4 becomes 6.

Duplicate rules both execute (two ×2 rules → 16 from 4).

Target rules run in a second pass after per-ball actions, using actual or adjusted over totals as configured.

## Versioning

`TournamentRuleSet` is versioned per tournament (`tournamentId` + `version`).

- Editing a version that already has match snapshots is rejected. Create a new version instead.
- Activating a version enables it for **new** matches only.
- Historical versions used by live/completed matches are never mutated.

## Match snapshot

On innings start:

1. If the match already has a snapshot, keep it (locked).
2. Else copy the tournament’s enabled rule set into `MatchRuleSnapshot.rulesJson`.

Completed and live matches always score against that snapshot, even if the tournament later publishes version N+1.

## Scoring calculation

Each live ball keeps original `BallEvent` runs. Derived fields:

| Field | Meaning |
|-------|---------|
| original / actual | cricket event |
| counted | tournament total after rules |
| bonus / penalty | signed adjustments |
| multiplier | product of multiply actions |
| reason | human-readable explanation |

Undo marks the event undone and **re-derives** evaluations for the remaining live events. Audit rows are rebuilt from the current event list; original `BallEvent` rows stay.

Offline: the scorer still enqueues normal `BallEvent`s. The match already holds its snapshot. After sync the server evaluates authoritatively.

## Result, NRR, player stats

Each rule has affect flags (defaults):

| Flag | Default |
|------|---------|
| Match result | true |
| Tournament points | true |
| NRR | false |
| Player stats | false |
| Team stats | false |
| Display only | false |

- **Result / 2nd-innings target:** counted innings totals when any enabled rule has `affectsMatchResult`.
- **NRR:** actual `replayInnings` runs unless a rule sets `affectsNrr`, in which case points-table uses `nrrRuns` from the snapshot’s derived totals.
- **Player career stats:** `replayInnings` remains the live/scorecard source of truth. Persisted career totals stay actual cricket unless a snapshotted rule sets `affectsPlayerStats`, in which case `eventStatPolicy` + counted-run deltas apply only at persist time. Penalty / wide / bye / undo never count as batter stats. Default remains off so multipliers cannot silently inflate records.
- **MVP / Super Stars:** actual bat / bowl / field stats through `computeStreetMvp`. Uses the snapshotted `MvpConfig` (default street table if none). See [MVP-FORMULA.md](./MVP-FORMULA.md). Tournament counted team runs are not used.

## Permissions

| Role | Read | Create / edit / activate / preview |
|------|------|-------------------------------------|
| Tournament admin (ADMIN / SUPER_ADMIN, or SCORER/TEAM_MANAGER who created the tournament) | yes | yes |
| Scorer (other) | match overlay | no |
| Viewer (authenticated) | tournament rules GET | no |
| Public live | summary + actual/counted effects only (no rule ids / admin config) | no |

## Offline / undo / sockets

- Offline queue unchanged.
- Undo re-runs `evaluateInnings`.
- Public Socket.IO payload is the existing live DTO; `customRules` is included when enabled (summary, last-ball actual/counted, optional score). Private rule configuration is not broadcast.

## Examples

1. Street T10, Over 3 ×2, ball of 4 → actual 4, counted 8.
2. Over 4 target 10, score 8, fail = do not count over → actual 8, counted 0.
3. Wicket −5 from 50 → counted 45.
4. Ball +3 bonus on 2 → 5.
5. Ball 6 ×2 → 12.
6. Tournament A rules off, same 4 → 4; Tournament B ×2 → 8.
7. Match snapshotted on v1 (×2) stays ×2 after tournament v2 (×3).

## UI

Tournament → More → Custom Rules (`/tournaments/:id/rules`). Scorer keypad is unchanged; a compact **Rule Active** chip shows last adjustment. Match Centre / public live show the same chip only when a snapshot is enabled.
