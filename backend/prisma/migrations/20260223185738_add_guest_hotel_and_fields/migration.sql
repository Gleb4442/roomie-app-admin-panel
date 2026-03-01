-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntrySource" ADD VALUE 'qr_elevator';
ALTER TYPE "EntrySource" ADD VALUE 'direct';

-- AlterTable
ALTER TABLE "hotels" ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "guest_hotels" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "source" "EntrySource" NOT NULL DEFAULT 'organic',
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roomNumber" TEXT,
    "contextParams" JSONB,

    CONSTRAINT "guest_hotels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guest_hotels_guestId_hotelId_key" ON "guest_hotels"("guestId", "hotelId");

-- AddForeignKey
ALTER TABLE "guest_hotels" ADD CONSTRAINT "guest_hotels_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guest_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_hotels" ADD CONSTRAINT "guest_hotels_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
