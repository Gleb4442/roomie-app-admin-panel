-- AlterTable
ALTER TABLE "guest_stays" ADD COLUMN     "externalReservationId" TEXT,
ADD COLUMN     "pmsProvider" TEXT,
ADD COLUMN     "pmsRawData" JSONB,
ADD COLUMN     "preCheckinData" JSONB,
ADD COLUMN     "preCheckinExpiresAt" TIMESTAMP(3),
ADD COLUMN     "preCheckinUrl" TEXT,
ADD COLUMN     "roomType" TEXT,
ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "hotel_pms_configs" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "webhookSecret" TEXT;

-- CreateTable
CREATE TABLE "stage_transitions" (
    "id" TEXT NOT NULL,
    "guestStayId" TEXT NOT NULL,
    "fromStage" TEXT NOT NULL,
    "toStage" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stage_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_sms_configs" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "credentials" JSONB NOT NULL,
    "senderName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_sms_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_logs" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "guestId" TEXT,
    "guestStayId" TEXT,
    "phone" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "externalId" TEXT,
    "errorMsg" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stage_transitions_guestStayId_idx" ON "stage_transitions"("guestStayId");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_sms_configs_hotelId_key" ON "hotel_sms_configs"("hotelId");

-- CreateIndex
CREATE INDEX "sms_logs_hotelId_createdAt_idx" ON "sms_logs"("hotelId", "createdAt");

-- CreateIndex
CREATE INDEX "sms_logs_guestStayId_idx" ON "sms_logs"("guestStayId");

-- CreateIndex
CREATE UNIQUE INDEX "guest_stays_externalReservationId_key" ON "guest_stays"("externalReservationId");

-- AddForeignKey
ALTER TABLE "stage_transitions" ADD CONSTRAINT "stage_transitions_guestStayId_fkey" FOREIGN KEY ("guestStayId") REFERENCES "guest_stays"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_sms_configs" ADD CONSTRAINT "hotel_sms_configs_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_guestStayId_fkey" FOREIGN KEY ("guestStayId") REFERENCES "guest_stays"("id") ON DELETE SET NULL ON UPDATE CASCADE;

