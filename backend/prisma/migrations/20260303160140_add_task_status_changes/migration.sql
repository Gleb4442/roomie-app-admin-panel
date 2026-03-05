-- CreateTable
CREATE TABLE "task_status_changes" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedById" TEXT,
    "changedByType" TEXT NOT NULL DEFAULT 'system',
    "reason" TEXT,
    "syncedToExternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_status_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_status_changes_taskId_taskType_idx" ON "task_status_changes"("taskId", "taskType");
