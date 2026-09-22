-- AlterTable
ALTER TABLE "Club" ADD COLUMN "ballTypes" "BallType"[] DEFAULT ARRAY[]::"BallType"[];
