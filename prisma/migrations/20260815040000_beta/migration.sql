-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "disabledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "isBeta" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'ACCESS';
ALTER TABLE "Invitation" ADD COLUMN "revokedAt" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "FeedbackSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "FeedbackStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateTable
CREATE TABLE "BetaFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "screen" TEXT,
    "severity" "FeedbackSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "FeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BetaFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BetaFeedback_status_createdAt_idx" ON "BetaFeedback"("status", "createdAt");
ALTER TABLE "BetaFeedback" ADD CONSTRAINT "BetaFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
