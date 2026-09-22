-- CreateEnum
CREATE TYPE "ShareVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN "visibility" "ShareVisibility" NOT NULL DEFAULT 'PRIVATE';
ALTER TABLE "Match" ADD COLUMN "publicScorecardEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Match" ADD COLUMN "publicStatsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Match" ADD COLUMN "publicMvpEnabled" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Match" SET "visibility" = 'UNLISTED' WHERE "publicLiveEnabled" = true;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN "publicSlug" TEXT;
ALTER TABLE "Tournament" ADD COLUMN "visibility" "ShareVisibility" NOT NULL DEFAULT 'PRIVATE';

CREATE UNIQUE INDEX "Tournament_publicSlug_key" ON "Tournament"("publicSlug");
CREATE INDEX "Tournament_visibility_idx" ON "Tournament"("visibility");
CREATE INDEX "Match_visibility_idx" ON "Match"("visibility");
