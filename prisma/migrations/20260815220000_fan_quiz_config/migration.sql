-- CreateEnum
CREATE TYPE "FanQuizStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED');

-- AlterTable
ALTER TABLE "FanSettings" ALTER COLUMN "quizzesEnabled" SET DEFAULT false;
ALTER TABLE "FanSettings" ADD COLUMN "quizName" TEXT;
ALTER TABLE "FanSettings" ADD COLUMN "quizDescription" TEXT;
ALTER TABLE "FanSettings" ADD COLUMN "quizStatus" "FanQuizStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "FanSettings" ADD COLUMN "quizStartAt" TIMESTAMP(3);
ALTER TABLE "FanSettings" ADD COLUMN "quizEndAt" TIMESTAMP(3);

-- Existing rows were created with the old default (ON). Only keep quiz ON when
-- the organizer already published a quiz question for that tournament.
UPDATE "FanSettings"
SET "quizzesEnabled" = false
WHERE "quizzesEnabled" = true
  AND "tournamentId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "FanQuestion" q
    WHERE q."tournamentId" = "FanSettings"."tournamentId"
      AND q."kind" = 'QUIZ'
      AND q."status" IN ('OPEN', 'LOCKED', 'SETTLED')
  );

UPDATE "FanSettings"
SET "quizStatus" = 'ACTIVE'
WHERE "quizzesEnabled" = true AND "tournamentId" IS NOT NULL;

-- Match-level quiz toggles no longer control visibility.
UPDATE "FanSettings"
SET "quizzesEnabled" = false
WHERE "matchId" IS NOT NULL;

ALTER TABLE "FanQuestion" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
