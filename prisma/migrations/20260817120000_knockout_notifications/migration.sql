-- CreateEnum
CREATE TYPE "TournamentStageType" AS ENUM ('GROUP_STAGE', 'KNOCKOUT', 'GROUP_AND_KNOCKOUT');

-- CreateEnum
CREATE TYPE "TournamentLifecycle" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "KnockoutRound" AS ENUM ('ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL');

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN "stageType" "TournamentStageType" NOT NULL DEFAULT 'GROUP_STAGE';
ALTER TABLE "Tournament" ADD COLUMN "lifecycle" "TournamentLifecycle" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "Tournament" ADD COLUMN "knockoutTeamCount" INTEGER;
ALTER TABLE "Tournament" ADD COLUMN "includeThirdPlace" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tournament" ADD COLUMN "pairingMode" TEXT NOT NULL DEFAULT 'SEEDED';
ALTER TABLE "Tournament" ADD COLUMN "championTeamId" TEXT;
ALTER TABLE "Tournament" ADD COLUMN "runnerUpTeamId" TEXT;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN "groupId" TEXT;
ALTER TABLE "Match" ADD COLUMN "knockoutRound" "KnockoutRound";
ALTER TABLE "Match" ADD COLUMN "knockoutSlot" INTEGER;
ALTER TABLE "Match" ADD COLUMN "feedsIntoMatchId" TEXT;
ALTER TABLE "Match" ADD COLUMN "feedsIntoSide" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'GENERIC';
ALTER TABLE "Notification" ADD COLUMN "link" TEXT;
ALTER TABLE "Notification" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'IN_APP';
ALTER TABLE "Notification" ADD COLUMN "deliveryStatus" TEXT NOT NULL DEFAULT 'DELIVERED';
ALTER TABLE "Notification" ADD COLUMN "meta" JSONB;

-- CreateIndex
CREATE INDEX "Match_groupId_idx" ON "Match"("groupId");
CREATE INDEX "Match_knockoutRound_knockoutSlot_idx" ON "Match"("knockoutRound", "knockoutSlot");
CREATE INDEX "Match_feedsIntoMatchId_idx" ON "Match"("feedsIntoMatchId");
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_championTeamId_fkey" FOREIGN KEY ("championTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_runnerUpTeamId_fkey" FOREIGN KEY ("runnerUpTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TournamentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_feedsIntoMatchId_fkey" FOREIGN KEY ("feedsIntoMatchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
