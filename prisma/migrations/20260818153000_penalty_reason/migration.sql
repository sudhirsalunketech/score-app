-- CreateEnum
CREATE TYPE "PenaltyReason" AS ENUM ('TOURNAMENT_PENALTY', 'SLOW_OVER_RATE', 'MISCONDUCT', 'ILLEGAL_EQUIPMENT', 'OTHER');

-- AlterTable
ALTER TABLE "BallEvent" ADD COLUMN     "penaltyReason" "PenaltyReason";
