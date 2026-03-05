-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('FLOOR', 'SHIFT', 'SKILL', 'CUSTOM');

-- AlterTable
ALTER TABLE "service_categories" ADD COLUMN     "defaultDepartmentId" TEXT;

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "names" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_groups" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "GroupType" NOT NULL,
    "departmentId" TEXT NOT NULL,
    "floors" INTEGER[],
    "shiftStart" TEXT,
    "shiftEnd" TEXT,
    "skills" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_group_members" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,

    CONSTRAINT "staff_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_photos" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'issue',
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiAnalysis" JSONB,

    CONSTRAINT "task_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_notes" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL DEFAULT 'staff',
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_hotelId_slug_key" ON "departments"("hotelId", "slug");

-- CreateIndex
CREATE INDEX "staff_groups_hotelId_departmentId_idx" ON "staff_groups"("hotelId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_group_members_groupId_staffId_key" ON "staff_group_members"("groupId", "staffId");

-- CreateIndex
CREATE INDEX "task_photos_taskId_taskType_idx" ON "task_photos"("taskId", "taskType");

-- CreateIndex
CREATE INDEX "task_notes_taskId_taskType_idx" ON "task_notes"("taskId", "taskType");

-- AddForeignKey
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_defaultDepartmentId_fkey" FOREIGN KEY ("defaultDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_groups" ADD CONSTRAINT "staff_groups_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_groups" ADD CONSTRAINT "staff_groups_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_group_members" ADD CONSTRAINT "staff_group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "staff_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_group_members" ADD CONSTRAINT "staff_group_members_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_photos" ADD CONSTRAINT "task_photos_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
