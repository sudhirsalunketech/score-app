-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "winningBonusPoints" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TournamentPoint" ADD COLUMN     "bonusPoints" INTEGER NOT NULL DEFAULT 0;
