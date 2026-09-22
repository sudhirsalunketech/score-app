# Scoring engine

Package: `@crickscore/shared` (`replayInnings`).

```
BallEvent (append-only)
    → filter !isUndone
    → replay
    → innings snapshot (score, wickets, overs, SR, Eco, FoW, partnership)
    → persist projections in the same DB transaction
```

## Delivery fields

`idempotencyKey`, striker, non-striker, bowler, `batsmanRuns`, `extraType`, `extraRuns`, wicket + `dismissalType`.

Legal balls exclude Wide, No Ball, and Penalty. `ballsPerOver` is match configuration (4–8), never hardcoded to 6.

## Strike

Odd legal runs (or odd byes/leg-byes) rotate. Completing an over rotates again.

## Wickets

Bowler credit: Bowled, Caught, LBW, Stumped, Hit Wicket, Over The Fence, One Hand One Bounce, Mankad (configurable). No credit for Run Out.

## Undo

Marks the last live event `isUndone` and replays. History is retained.

## Tests

`packages/shared/src/index.test.ts` covers 0–6, extras, no-ball + boundary, wide + extra runs, bye/leg-bye, wicket, run-out + runs, mankad, 5-ball overs, maidens, undo, NRR all-out, street MVP.
