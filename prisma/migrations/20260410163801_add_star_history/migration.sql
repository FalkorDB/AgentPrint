-- CreateTable
CREATE TABLE "StarHistory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "cumulativeStars" INTEGER NOT NULL,

    CONSTRAINT "StarHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StarHistory_projectId_month_idx" ON "StarHistory"("projectId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "StarHistory_projectId_month_key" ON "StarHistory"("projectId", "month");

-- AddForeignKey
ALTER TABLE "StarHistory" ADD CONSTRAINT "StarHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
