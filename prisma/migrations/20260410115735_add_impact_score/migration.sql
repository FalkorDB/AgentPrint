-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "impactConfidence" TEXT,
ADD COLUMN     "impactScore" DOUBLE PRECISION,
ADD COLUMN     "impactScoreComputedAt" TIMESTAMP(3),
ADD COLUMN     "impactScoreVersion" INTEGER NOT NULL DEFAULT 1;
