-- CreateEnum
CREATE TYPE "EntrySource" AS ENUM ('widget', 'qr_room', 'qr_lobby', 'qr_restaurant', 'qr_spa', 'sms_booking', 'organic');

-- CreateEnum
CREATE TYPE "JourneyStage" AS ENUM ('PRE_ARRIVAL', 'CHECKED_IN', 'IN_STAY', 'CHECKOUT', 'POST_STAY', 'BETWEEN_STAYS');

-- CreateTable
CREATE TABLE "guest_accounts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdVia" "EntrySource" NOT NULL DEFAULT 'organic',
    "roomieChatId" TEXT,
    "profile" JSONB,
    "preferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "location" TEXT,
    "theme" JSONB,
    "accentColor" TEXT DEFAULT '#1152d4',
    "imageUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_stays" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "bookingRef" TEXT,
    "stage" "JourneyStage" NOT NULL DEFAULT 'BETWEEN_STAYS',
    "roomNumber" TEXT,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "enteredVia" "EntrySource",
    "pmsData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_stays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_opens" (
    "id" TEXT NOT NULL,
    "guestId" TEXT,
    "hotelId" TEXT,
    "source" "EntrySource" NOT NULL,
    "contextParams" JSONB,
    "deviceInfo" JSONB,
    "resultedInRegistration" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_opens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guest_accounts_email_key" ON "guest_accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "hotels_slug_key" ON "hotels"("slug");

-- AddForeignKey
ALTER TABLE "guest_stays" ADD CONSTRAINT "guest_stays_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guest_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_stays" ADD CONSTRAINT "guest_stays_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_opens" ADD CONSTRAINT "app_opens_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guest_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_opens" ADD CONSTRAINT "app_opens_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
