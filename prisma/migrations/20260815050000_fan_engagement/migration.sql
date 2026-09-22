-- CreateEnum
CREATE TYPE "FanQuestionKind" AS ENUM ('PREDICTION', 'QUIZ');
CREATE TYPE "FanQuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'NUMBER', 'YES_NO', 'PLAYER', 'TEAM');
CREATE TYPE "FanQuestionScope" AS ENUM ('MATCH', 'TOURNAMENT');
CREATE TYPE "FanQuestionStatus" AS ENUM ('DRAFT', 'OPEN', 'LOCKED', 'SETTLED', 'CANCELLED');
CREATE TYPE "FanSettlementMode" AS ENUM ('AUTO', 'MANUAL');
CREATE TYPE "FanPointSource" AS ENUM ('PREDICTION_CORRECT', 'QUIZ_CORRECT', 'QUIZ_FAST', 'TOURNAMENT_PREDICTION', 'BADGE_REWARD', 'ADMIN_ADJUSTMENT');
CREATE TYPE "ChatMessageKind" AS ENUM ('USER', 'SYSTEM');
CREATE TYPE "ChatReportStatus" AS ENUM ('OPEN', 'DISMISSED');

-- CreateTable
CREATE TABLE "FanSettings" (
    "id" TEXT NOT NULL,
    "matchId" TEXT,
    "tournamentId" TEXT,
    "chatEnabled" BOOLEAN NOT NULL DEFAULT true,
    "publicChat" BOOLEAN NOT NULL DEFAULT true,
    "loginRequiredToChat" BOOLEAN NOT NULL DEFAULT true,
    "predictionsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "quizzesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "moderationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "revealPercentagesAfterLock" BOOLEAN NOT NULL DEFAULT true,
    "minAnswersForPercentages" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FanSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FanSettings_matchId_key" ON "FanSettings"("matchId");
CREATE UNIQUE INDEX "FanSettings_tournamentId_key" ON "FanSettings"("tournamentId");

ALTER TABLE "FanSettings" ADD CONSTRAINT "FanSettings_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FanSettings" ADD CONSTRAINT "FanSettings_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT,
    "body" TEXT NOT NULL,
    "kind" "ChatMessageKind" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatMessage_matchId_createdAt_idx" ON "ChatMessage"("matchId", "createdAt");
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ChatMute" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "mutedUntil" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatMute_matchId_userId_key" ON "ChatMute"("matchId", "userId");
CREATE INDEX "ChatMute_userId_idx" ON "ChatMute"("userId");
ALTER TABLE "ChatMute" ADD CONSTRAINT "ChatMute_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMute" ADD CONSTRAINT "ChatMute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMute" ADD CONSTRAINT "ChatMute_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ChatReport" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ChatReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatReport_status_createdAt_idx" ON "ChatReport"("status", "createdAt");
ALTER TABLE "ChatReport" ADD CONSTRAINT "ChatReport_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatReport" ADD CONSTRAINT "ChatReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FanQuestion" (
    "id" TEXT NOT NULL,
    "kind" "FanQuestionKind" NOT NULL,
    "type" "FanQuestionType" NOT NULL DEFAULT 'SINGLE_CHOICE',
    "scope" "FanQuestionScope" NOT NULL,
    "matchId" TEXT,
    "tournamentId" TEXT,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "description" TEXT,
    "points" INTEGER NOT NULL DEFAULT 10,
    "status" "FanQuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "templateKey" TEXT,
    "openAt" TIMESTAMP(3),
    "lockAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "timeLimitSec" INTEGER,
    "settlementMode" "FanSettlementMode" NOT NULL DEFAULT 'AUTO',
    "settlementRule" TEXT NOT NULL DEFAULT 'EXACT',
    "correctOptionIds" TEXT[],
    "correctNumber" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FanQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FanQuestion_matchId_kind_status_idx" ON "FanQuestion"("matchId", "kind", "status");
CREATE INDEX "FanQuestion_tournamentId_kind_status_idx" ON "FanQuestion"("tournamentId", "kind", "status");
CREATE INDEX "FanQuestion_templateKey_idx" ON "FanQuestion"("templateKey");
ALTER TABLE "FanQuestion" ADD CONSTRAINT "FanQuestion_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FanQuestion" ADD CONSTRAINT "FanQuestion_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FanQuestion" ADD CONSTRAINT "FanQuestion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FanOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "playerId" TEXT,
    "teamId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FanOption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FanOption_questionId_idx" ON "FanOption"("questionId");
ALTER TABLE "FanOption" ADD CONSTRAINT "FanOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "FanQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FanAnswer" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optionIds" TEXT[],
    "numberValue" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FanAnswer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FanAnswer_questionId_userId_key" ON "FanAnswer"("questionId", "userId");
CREATE INDEX "FanAnswer_userId_idx" ON "FanAnswer"("userId");
ALTER TABLE "FanAnswer" ADD CONSTRAINT "FanAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "FanQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FanAnswer" ADD CONSTRAINT "FanAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FanPointTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceType" "FanPointSource" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "matchId" TEXT,
    "tournamentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FanPointTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FanPointTransaction_sourceType_sourceId_userId_key" ON "FanPointTransaction"("sourceType", "sourceId", "userId");
CREATE INDEX "FanPointTransaction_userId_createdAt_idx" ON "FanPointTransaction"("userId", "createdAt");
CREATE INDEX "FanPointTransaction_matchId_idx" ON "FanPointTransaction"("matchId");
CREATE INDEX "FanPointTransaction_tournamentId_idx" ON "FanPointTransaction"("tournamentId");
ALTER TABLE "FanPointTransaction" ADD CONSTRAINT "FanPointTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FanPointTransaction" ADD CONSTRAINT "FanPointTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FanPointTransaction" ADD CONSTRAINT "FanPointTransaction_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FanPointTransaction" ADD CONSTRAINT "FanPointTransaction_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FanBadgeAward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeKey" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FanBadgeAward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FanBadgeAward_userId_badgeKey_key" ON "FanBadgeAward"("userId", "badgeKey");
CREATE INDEX "FanBadgeAward_userId_idx" ON "FanBadgeAward"("userId");
ALTER TABLE "FanBadgeAward" ADD CONSTRAINT "FanBadgeAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
