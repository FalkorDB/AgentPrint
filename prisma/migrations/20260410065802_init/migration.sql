-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "githubAppInstallationId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commit" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "authorLogin" TEXT,
    "authorEmail" TEXT,
    "authorName" TEXT,
    "message" TEXT,
    "committedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitFileStat" (
    "id" TEXT NOT NULL,
    "commitId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "additions" INTEGER NOT NULL,
    "deletions" INTEGER NOT NULL,

    CONSTRAINT "CommitFileStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PullRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "authorLogin" TEXT,
    "title" TEXT,
    "state" TEXT NOT NULL,
    "merged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "mergedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "PullRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PullRequestReview" (
    "id" TEXT NOT NULL,
    "pullRequestId" TEXT NOT NULL,
    "reviewerLogin" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PullRequestReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyMetric" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "metricVersion" INTEGER NOT NULL DEFAULT 1,
    "activeDevs" INTEGER NOT NULL,
    "activeCodeContributors" INTEGER NOT NULL,
    "linesChangedPerDev" DOUBLE PRECISION,
    "prMergeRatePerDev" DOUBLE PRECISION,
    "prRejectionRate" DOUBLE PRECISION,
    "firstTimeContribRatio" DOUBLE PRECISION,
    "medianTtmHours" DOUBLE PRECISION,
    "medianTtcHours" DOUBLE PRECISION,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepoSyncState" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "lastCommitSha" TEXT,
    "lastCommitDate" TIMESTAMP(3),
    "lastPrUpdatedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),

    CONSTRAINT "RepoSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_owner_repo_key" ON "Project"("owner", "repo");

-- CreateIndex
CREATE INDEX "Commit_projectId_committedAt_idx" ON "Commit"("projectId", "committedAt");

-- CreateIndex
CREATE INDEX "Commit_authorLogin_idx" ON "Commit"("authorLogin");

-- CreateIndex
CREATE UNIQUE INDEX "Commit_projectId_sha_key" ON "Commit"("projectId", "sha");

-- CreateIndex
CREATE INDEX "CommitFileStat_commitId_idx" ON "CommitFileStat"("commitId");

-- CreateIndex
CREATE INDEX "PullRequest_projectId_createdAt_idx" ON "PullRequest"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "PullRequest_projectId_mergedAt_idx" ON "PullRequest"("projectId", "mergedAt");

-- CreateIndex
CREATE INDEX "PullRequest_projectId_closedAt_idx" ON "PullRequest"("projectId", "closedAt");

-- CreateIndex
CREATE INDEX "PullRequest_authorLogin_idx" ON "PullRequest"("authorLogin");

-- CreateIndex
CREATE UNIQUE INDEX "PullRequest_projectId_number_key" ON "PullRequest"("projectId", "number");

-- CreateIndex
CREATE INDEX "PullRequestReview_pullRequestId_idx" ON "PullRequestReview"("pullRequestId");

-- CreateIndex
CREATE INDEX "PullRequestReview_reviewerLogin_idx" ON "PullRequestReview"("reviewerLogin");

-- CreateIndex
CREATE INDEX "MonthlyMetric_projectId_month_idx" ON "MonthlyMetric"("projectId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyMetric_projectId_month_metricVersion_key" ON "MonthlyMetric"("projectId", "month", "metricVersion");

-- CreateIndex
CREATE UNIQUE INDEX "RepoSyncState_projectId_key" ON "RepoSyncState"("projectId");

-- AddForeignKey
ALTER TABLE "Commit" ADD CONSTRAINT "Commit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitFileStat" ADD CONSTRAINT "CommitFileStat_commitId_fkey" FOREIGN KEY ("commitId") REFERENCES "Commit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PullRequest" ADD CONSTRAINT "PullRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PullRequestReview" ADD CONSTRAINT "PullRequestReview_pullRequestId_fkey" FOREIGN KEY ("pullRequestId") REFERENCES "PullRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyMetric" ADD CONSTRAINT "MonthlyMetric_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepoSyncState" ADD CONSTRAINT "RepoSyncState_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
