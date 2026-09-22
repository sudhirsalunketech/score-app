-- CreateEnum
CREATE TYPE "MatchResultType" AS ENUM ('WIN', 'TIE', 'NO_RESULT', 'ABANDONED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatchMarginType" AS ENUM ('RUNS', 'WICKETS');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN "resultType" "MatchResultType",
ADD COLUMN "resultWinnerTeamId" TEXT,
ADD COLUMN "marginType" "MatchMarginType",
ADD COLUMN "marginValue" INTEGER,
ADD COLUMN "completedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MatchPlayer" ADD COLUMN "isCaptain" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isViceCaptain" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isWicketKeeper" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "battingOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "MatchPlayer_matchId_teamId_idx" ON "MatchPlayer"("matchId", "teamId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_resultWinnerTeamId_fkey" FOREIGN KEY ("resultWinnerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
