-- CreateEnum
CREATE TYPE "AccessStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED');
CREATE TYPE "AccessLevel" AS ENUM ('VIEWER', 'PLAYER', 'SCORER', 'MATCH_ADMIN', 'TOURNAMENT_ADMIN', 'CUSTOM');

-- CreateTable
CREATE TABLE "MatchAccess" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "AccessLevel" NOT NULL,
    "permissions" TEXT[],
    "status" "AccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TournamentAccess" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "AccessLevel" NOT NULL,
    "permissions" TEXT[],
    "status" "AccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "playerId" TEXT,
    "teamId" TEXT,
    "matchId" TEXT,
    "tournamentId" TEXT,
    "level" "AccessLevel" NOT NULL DEFAULT 'PLAYER',
    "permissions" TEXT[],
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MatchAccess_matchId_userId_key" ON "MatchAccess"("matchId", "userId");
CREATE INDEX "MatchAccess_userId_status_idx" ON "MatchAccess"("userId", "status");
CREATE UNIQUE INDEX "TournamentAccess_tournamentId_userId_key" ON "TournamentAccess"("tournamentId", "userId");
CREATE INDEX "TournamentAccess_userId_status_idx" ON "TournamentAccess"("userId", "status");
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");
CREATE INDEX "Invitation_tokenHash_idx" ON "Invitation"("tokenHash");

ALTER TABLE "MatchAccess" ADD CONSTRAINT "MatchAccess_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchAccess" ADD CONSTRAINT "MatchAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchAccess" ADD CONSTRAINT "MatchAccess_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TournamentAccess" ADD CONSTRAINT "TournamentAccess_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentAccess" ADD CONSTRAINT "TournamentAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentAccess" ADD CONSTRAINT "TournamentAccess_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
