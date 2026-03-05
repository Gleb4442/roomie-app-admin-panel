-- CreateEnum
CREATE TYPE "HousekeepingStatus" AS ENUM ('DIRTY', 'CLEANING', 'CLEANED', 'INSPECTED', 'READY', 'OUT_OF_ORDER', 'DO_NOT_DISTURB');

-- CreateEnum
CREATE TYPE "OccupancyStatus" AS ENUM ('VACANT', 'OCCUPIED', 'STAYOVER', 'CHECKOUT', 'CHECKIN');

-- AlterTable
ALTER TABLE "internal_tasks" ADD COLUMN     "roomId" TEXT;

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "roomType" TEXT,
    "maxOccupancy" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "housekeepingStatus" "HousekeepingStatus" NOT NULL DEFAULT 'READY',
    "occupancyStatus" "OccupancyStatus" NOT NULL DEFAULT 'VACANT',
    "assignedCleanerId" TEXT,
    "assignedInspectorId" TEXT,
    "lastStatusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCleanedAt" TIMESTAMP(3),
    "lastInspectedAt" TIMESTAMP(3),
    "estimatedReadyAt" TIMESTAMP(3),
    "isRush" BOOLEAN NOT NULL DEFAULT false,
    "dndActive" BOOLEAN NOT NULL DEFAULT false,
    "dndStartedAt" TIMESTAMP(3),
    "notes" TEXT,
    "pmsRoomId" TEXT,
    "lastPmsSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_status_changes" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "fromHousekeeping" "HousekeepingStatus",
    "toHousekeeping" "HousekeepingStatus",
    "fromOccupancy" "OccupancyStatus",
    "toOccupancy" "OccupancyStatus",
    "changedByStaffId" TEXT,
    "changedBySystem" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_status_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rooms_hotelId_floor_idx" ON "rooms"("hotelId", "floor");

-- CreateIndex
CREATE INDEX "rooms_hotelId_housekeepingStatus_idx" ON "rooms"("hotelId", "housekeepingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_hotelId_roomNumber_key" ON "rooms"("hotelId", "roomNumber");

-- CreateIndex
CREATE INDEX "room_status_changes_roomId_idx" ON "room_status_changes"("roomId");

-- CreateIndex
CREATE INDEX "internal_tasks_roomId_idx" ON "internal_tasks"("roomId");

-- AddForeignKey
ALTER TABLE "internal_tasks" ADD CONSTRAINT "internal_tasks_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_assignedCleanerId_fkey" FOREIGN KEY ("assignedCleanerId") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_assignedInspectorId_fkey" FOREIGN KEY ("assignedInspectorId") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_status_changes" ADD CONSTRAINT "room_status_changes_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
