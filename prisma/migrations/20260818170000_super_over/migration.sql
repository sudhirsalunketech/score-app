-- Super Over + configurable tie points
ALTER TYPE "MatchStatus" ADD VALUE 'SUPER_OVER_PENDING';
ALTER TYPE "MatchStatus" ADD VALUE 'SUPER_OVER';

ALTER TABLE "Tournament" ADD COLUMN "tiePoints" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Innings" ADD COLUMN "isSuperOver" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Innings" ADD COLUMN "superOverNumber" INTEGER;
ALTER TABLE "Innings" ADD COLUMN "oversLimit" INTEGER;
ALTER TABLE "Innings" ADD COLUMN "maxWicketsLimit" INTEGER;
