-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "githubCommitCount" INTEGER,
ADD COLUMN     "githubCreatedAt" TIMESTAMP(3),
ADD COLUMN     "githubPrCount" INTEGER;
