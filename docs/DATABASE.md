# Database

PostgreSQL + Prisma. Schema: `prisma/schema.prisma`. Every change is a migration under `prisma/migrations/`.

## Core tables

| Area | Tables |
|------|--------|
| Identity | `users`, `role_definitions`, `permissions`, `role_permissions`, `refresh_tokens`, `password_resets` |
| Cricket entities | `players`, `player_profiles`, `teams`, `team_players`, `clubs`, `venues` |
| Competition | `tournaments`, `tournament_groups`, `tournament_group_teams`, `tournament_points`, `tournament_rule_sets`, `tournament_rules` |
| Match | `matches`, `match_teams`, `match_players`, `match_officials`, `tosses`, `match_rule_snapshots`, `ball_rule_evaluations` |
| Scoring | `innings`, `overs`, `ball_events`, `wickets`, `extras`, `partnerships`, `fall_of_wickets` |
| Stats | `player_statistics`, `team_statistics`, `match_statistics` |
| Product | `notifications`, `user_preferences`, `audit_logs` |
| Fan | `chat_messages` (optional `parentId`), `chat_reactions`, `fan_questions`, `fan_answers`, `fan_point_transactions` |

## Scoring integrity

- `ball_events.idempotency_key` unique per innings.
- Sequence unique per innings.
- Undo sets `is_undone`; never delete history.
- Innings totals are **projections** rewritten inside the same transaction as the event.

## Indexes

Status, tournament, match teams, innings events, audit `(entity, entityId)`, notifications `userId`, `Match.publicSlug` (unique), `Match.publicLiveEnabled`.

Live fields on `Match`: `publicLiveEnabled`, `publicSlug`, `youtubeVideoId`, `youtubeEnabled`. Migration: `20260814143000_public_live`.

Tournament custom rules: `TournamentRuleSet`, `TournamentRule`, `MatchRuleSnapshot`, `BallRuleEvaluation`. Migration: `20260815010000_tournament_custom_rules`. See `TOURNAMENT-RULES.md`.

Broadcast gap pass: `MatchStatus` drinks/rain/delay, `RefreshToken` device metadata, `ChatMessage.parentId`, `ChatReaction`. Migration: `20260817100000_broadcast_gap_pass`.

Knockout + notifications: `Tournament.stageType/lifecycle/championTeamId/runnerUpTeamId`, `Match.knockoutRound/knockoutSlot/feedsIntoMatchId`, `Notification.type/link/channel/deliveryStatus`. Migration: `20260817120000_knockout_notifications`.
