-- CreateTable
CREATE TABLE "TournamentRuleSet" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentRuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentRule" (
    "id" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "conditionConfig" JSONB NOT NULL,
    "action" TEXT NOT NULL,
    "actionConfig" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "affectsMatchResult" BOOLEAN NOT NULL DEFAULT true,
    "affectsTournamentPoints" BOOLEAN NOT NULL DEFAULT true,
    "affectsNrr" BOOLEAN NOT NULL DEFAULT false,
    "affectsPlayerStats" BOOLEAN NOT NULL DEFAULT false,
    "affectsTeamStats" BOOLEAN NOT NULL DEFAULT false,
    "displayOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchRuleSnapshot" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "rulesJson" JSONB NOT NULL,
    "derivedJson" JSONB,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchRuleSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BallRuleEvaluation" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "inningsId" TEXT NOT NULL,
    "ballEventId" TEXT NOT NULL,
    "originalRuns" INTEGER NOT NULL,
    "countedRuns" INTEGER NOT NULL,
    "penaltyRuns" INTEGER NOT NULL DEFAULT 0,
    "bonusRuns" INTEGER NOT NULL DEFAULT 0,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BallRuleEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TournamentRuleSet_tournamentId_version_key" ON "TournamentRuleSet"("tournamentId", "version");

-- CreateIndex
CREATE INDEX "TournamentRuleSet_tournamentId_enabled_idx" ON "TournamentRuleSet"("tournamentId", "enabled");

-- CreateIndex
CREATE INDEX "TournamentRule_ruleSetId_priority_idx" ON "TournamentRule"("ruleSetId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "MatchRuleSnapshot_matchId_key" ON "MatchRuleSnapshot"("matchId");

-- CreateIndex
CREATE INDEX "MatchRuleSnapshot_ruleSetId_idx" ON "MatchRuleSnapshot"("ruleSetId");

-- CreateIndex
CREATE UNIQUE INDEX "BallRuleEvaluation_ballEventId_key" ON "BallRuleEvaluation"("ballEventId");

-- CreateIndex
CREATE INDEX "BallRuleEvaluation_matchId_inningsId_idx" ON "BallRuleEvaluation"("matchId", "inningsId");

-- AddForeignKey
ALTER TABLE "TournamentRuleSet" ADD CONSTRAINT "TournamentRuleSet_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentRule" ADD CONSTRAINT "TournamentRule_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "TournamentRuleSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRuleSnapshot" ADD CONSTRAINT "MatchRuleSnapshot_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRuleSnapshot" ADD CONSTRAINT "MatchRuleSnapshot_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "TournamentRuleSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BallRuleEvaluation" ADD CONSTRAINT "BallRuleEvaluation_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BallRuleEvaluation" ADD CONSTRAINT "BallRuleEvaluation_ballEventId_fkey" FOREIGN KEY ("ballEventId") REFERENCES "BallEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
