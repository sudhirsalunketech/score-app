-- Manual match-wise points: a team-level "Set Qualify Status" flag, and manually-entered
-- fixtures (never scored through the app's live engine) that still count toward Points/NRR.
ALTER TABLE "TournamentGroupTeam" ADD COLUMN "qualifyStatus" TEXT;

-- CreateTable
CREATE TABLE "TournamentManualMatch" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL,
    "result" TEXT NOT NULL,
    "runsScored" INTEGER NOT NULL,
    "runsConceded" INTEGER NOT NULL,
    "ballsFaced" INTEGER NOT NULL,
    "ballsBowled" INTEGER NOT NULL,
    "ballsPerOver" INTEGER NOT NULL DEFAULT 6,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentManualMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TournamentManualMatch_tournamentId_teamId_idx" ON "TournamentManualMatch"("tournamentId", "teamId");

-- AddForeignKey
ALTER TABLE "TournamentManualMatch" ADD CONSTRAINT "TournamentManualMatch_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentManualMatch" ADD CONSTRAINT "TournamentManualMatch_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
