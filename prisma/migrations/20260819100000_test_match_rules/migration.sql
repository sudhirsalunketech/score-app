-- Test Match rules: declarations, draws, innings-victory margins, follow-on
ALTER TYPE "InningsStatus" ADD VALUE 'DECLARED';
ALTER TYPE "MatchResultType" ADD VALUE 'DRAW';
ALTER TYPE "MatchMarginType" ADD VALUE 'INNINGS';

ALTER TABLE "Match" ADD COLUMN "testDurationDays" INTEGER;
ALTER TABLE "Match" ADD COLUMN "followOnEnforced" BOOLEAN;
