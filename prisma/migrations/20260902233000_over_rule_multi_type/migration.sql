-- Allow multiple rule types (TARGET, RUN_BONUS, WICKET_PENALTY, CUSTOM) to be configured
-- simultaneously on the same over, one of each type at most.
DROP INDEX "OverRule_matchId_overNumber_key";
CREATE UNIQUE INDEX "OverRule_matchId_overNumber_ruleType_key" ON "OverRule"("matchId", "overNumber", "ruleType");

-- ruleType is always set by the application when a result row is created; tighten to NOT NULL
-- and widen the uniqueness to match so each rule type gets its own result row per over.
ALTER TABLE "OverRuleResult" ALTER COLUMN "ruleType" SET NOT NULL;
DROP INDEX "OverRuleResult_inningsId_overNumber_key";
CREATE UNIQUE INDEX "OverRuleResult_inningsId_overNumber_ruleType_key" ON "OverRuleResult"("inningsId", "overNumber", "ruleType");
