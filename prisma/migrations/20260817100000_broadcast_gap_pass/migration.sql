-- AlterEnum
ALTER TYPE "MatchStatus" ADD VALUE 'DRINKS_BREAK';
ALTER TYPE "MatchStatus" ADD VALUE 'RAIN_DELAY';
ALTER TYPE "MatchStatus" ADD VALUE 'MATCH_DELAY';

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN "parentId" TEXT;

-- CreateTable
CREATE TABLE "ChatReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatMessage_parentId_idx" ON "ChatMessage"("parentId");

-- CreateIndex
CREATE INDEX "ChatReaction_messageId_idx" ON "ChatReaction"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatReaction_messageId_userId_emoji_key" ON "ChatReaction"("messageId", "userId", "emoji");

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatReaction" ADD CONSTRAINT "ChatReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatReaction" ADD CONSTRAINT "ChatReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
