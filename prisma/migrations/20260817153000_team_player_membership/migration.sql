-- Historical team membership on the existing TeamPlayer roster (no duplicate TeamMember table).
-- MatchPlayer + BallEvent remain the source of match/tournament statistics after a player leaves.

ALTER TABLE "TeamPlayer" ADD COLUMN IF NOT EXISTS "role" TEXT;
ALTER TABLE "TeamPlayer" ADD COLUMN IF NOT EXISTS "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TeamPlayer" ADD COLUMN IF NOT EXISTS "leftAt" TIMESTAMP(3);
ALTER TABLE "TeamPlayer" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TeamPlayer" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
