-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "FanQuizStatus" NOT NULL DEFAULT 'DRAFT',
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Quiz_tournamentId_idx" ON "Quiz"("tournamentId");

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one Quiz row per tournament that had a configured or enabled quiz.
-- The OR quizzesEnabled=true clause matters: a row can be enabled+ACTIVE with a
-- null name via the generic PATCH /fan/settings path, which never went through
-- the frontend's quizStepError gate. Without it, that quiz would silently vanish.
INSERT INTO "Quiz" (id, "tournamentId", name, description, status, "startAt", "endAt", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "tournamentId", COALESCE("quizName", 'Fan Quiz'),
       "quizDescription", "quizStatus", "quizStartAt", "quizEndAt", now(), now()
FROM "FanSettings"
WHERE "tournamentId" IS NOT NULL AND ("quizName" IS NOT NULL OR "quizzesEnabled" = true);

-- AlterTable
ALTER TABLE "FanSettings" DROP COLUMN "quizDescription",
DROP COLUMN "quizEndAt",
DROP COLUMN "quizName",
DROP COLUMN "quizStartAt",
DROP COLUMN "quizStatus";
