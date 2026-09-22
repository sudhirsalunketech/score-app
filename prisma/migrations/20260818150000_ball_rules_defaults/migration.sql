-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "defaultBallsPerOver" INTEGER,
ADD COLUMN     "defaultNoBallsCountAsLegal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "defaultWidesCountAsLegal" BOOLEAN NOT NULL DEFAULT false;
