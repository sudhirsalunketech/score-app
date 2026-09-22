# Screen → component → API → database

Base URL: `/api/v1`. Envelope: `{ success, data, message }` / `{ success, error: { code, message } }`.

## Home (48)

- **Components:** `AppShell`, `MobileHeader`, `AppDrawer`, `MatchCard`, `ProfileSplitCard`, `TournamentCard`, `SectionHeader`
- **API:** `GET /home`
- **DB:** matches, innings, users, player_career_stats, tournaments
- **Actions:** open drawer, open match, open tournament, open profile

## Drawer (41)

- **Components:** `DrawerHeader`, `DrawerItem` (label start, icon end)
- **API:** `GET /users/me`
- **Items:** My Matches, My Tournaments, Profile, My Teams, My Clubs, Start Match, Create Tournament, Register As Club, Following, Settings

## Open Match (19, 35) + Toss (21)

- **Components:** `TeamSlot`, `FormatModal`, `TossDialog`
- **API:** `POST /matches`, `PATCH /matches/:id`, `POST /matches/:id/toss`
- **DB:** matches (format, overs, maxWickets, ballType, toss*)

## Scoring (26 + sheets)

- **Components:** `ScoreHeader`, `ScoringTables`, `OrangeKeypad`, `WicketSheet`, `MoreSheet`, `UndoButton`
- **API:** `GET /matches/:id/live`, `POST /innings/:id/events`, `POST /innings/:id/undo`
- **DB:** ball_events (append-only, idempotency_key), innings projections

## Scorecard (52)

- **Components:** `TeamToggle`, `BattingTable`, `BowlingTable`, `FallOfWickets`, `PartnershipGraphic`
- **API:** `GET /matches/:id/scorecard`

## Statistics hub (43–54)

- **Categories:** Most Runs, Most Wickets, Highest Score, Best Bowl, Best Economy, Most Maidens, Bowl Dots, Fastest 50, Fastest 100, Best Partnership, Most Balls, MVP
- **API:** `GET /statistics?scope=&id=&category=`
- **MVP:** street formula in `MVP-FORMULA.md`

## Tournaments / groups (01, 55)

- **API:** `GET|POST /tournaments/:id/groups`, `GET /tournaments/:id/points-table`, tournament rules under `/tournaments/:id/rules*`
- **DB:** tournament_groups, tournament_group_teams; points/NRR computed; optional `TournamentRuleSet` / `MatchRuleSnapshot`
- **Custom rules:** `TournamentRulesPage`, `CustomRulesBanner`
