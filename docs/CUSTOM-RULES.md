# Tournament custom rules

See `docs/TOURNAMENT-RULES.md` for the implemented engine.

Rules are tournament-specific, versioned (`TournamentRuleSet` + `TournamentRule`), snapshotted onto the match at first innings start (`MatchRuleSnapshot`), and evaluated into `BallRuleEvaluation`. They never rewrite `BallEvent` or `replayInnings`.
