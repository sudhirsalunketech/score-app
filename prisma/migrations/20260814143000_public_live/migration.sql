-- AlterTable
ALTER TABLE "Match" ADD COLUMN "publicLiveEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Match" ADD COLUMN "publicSlug" TEXT;
ALTER TABLE "Match" ADD COLUMN "youtubeVideoId" TEXT;
ALTER TABLE "Match" ADD COLUMN "youtubeEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Match_publicSlug_key" ON "Match"("publicSlug");

-- CreateIndex
CREATE INDEX "Match_publicLiveEnabled_idx" ON "Match"("publicLiveEnabled");
