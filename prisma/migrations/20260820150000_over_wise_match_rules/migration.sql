-- Over-wise match rules: additive, opt-in per match (default off), separate from the
-- tournament-wide TournamentRule engine and from player statistics.
ALTER TABLE "Match" ADD COLUMN "overWiseRulesEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "OverRule" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "overNumber" INTEGER NOT NULL,
    "name" TEXT,
    "ruleType" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OverRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OverRuleResult" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "inningsId" TEXT NOT NULL,
    "overNumber" INTEGER NOT NULL,
    "ruleId" TEXT,
    "ruleName" TEXT,
    "ruleType" TEXT,
    "actualRuns" INTEGER NOT NULL,
    "actualWickets" INTEGER NOT NULL,
    "bonusRuns" INTEGER NOT NULL DEFAULT 0,
    "penaltyRuns" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OverRuleResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OverRule_matchId_overNumber_key" ON "OverRule"("matchId", "overNumber");

-- CreateIndex
CREATE INDEX "OverRule_matchId_idx" ON "OverRule"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "OverRuleResult_inningsId_overNumber_key" ON "OverRuleResult"("inningsId", "overNumber");

-- CreateIndex
CREATE INDEX "OverRuleResult_matchId_idx" ON "OverRuleResult"("matchId");

-- AddForeignKey
ALTER TABLE "OverRule" ADD CONSTRAINT "OverRule_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OverRuleResult" ADD CONSTRAINT "OverRuleResult_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OverRuleResult" ADD CONSTRAINT "OverRuleResult_inningsId_fkey" FOREIGN KEY ("inningsId") REFERENCES "Innings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
