-- CreateTable
CREATE TABLE "qr_codes" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'in_room',
    "label" TEXT NOT NULL,
    "roomNumber" TEXT,
    "deepLink" TEXT NOT NULL,
    "qrImagePath" TEXT,
    "pdfPath" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "scanCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qr_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_scans" (
    "id" TEXT NOT NULL,
    "qrCodeId" TEXT NOT NULL,
    "guestId" TEXT,
    "userAgent" TEXT,
    "ip" TEXT,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qr_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_managers" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'manager',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_manager_hotels" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,

    CONSTRAINT "dashboard_manager_hotels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "qr_codes_hotelId_idx" ON "qr_codes"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "qr_codes_hotelId_roomNumber_key" ON "qr_codes"("hotelId", "roomNumber");

-- CreateIndex
CREATE INDEX "qr_scans_qrCodeId_scannedAt_idx" ON "qr_scans"("qrCodeId", "scannedAt");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_managers_username_key" ON "dashboard_managers"("username");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_manager_hotels_managerId_hotelId_key" ON "dashboard_manager_hotels"("managerId", "hotelId");

-- AddForeignKey
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_scans" ADD CONSTRAINT "qr_scans_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "qr_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_manager_hotels" ADD CONSTRAINT "dashboard_manager_hotels_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "dashboard_managers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_manager_hotels" ADD CONSTRAINT "dashboard_manager_hotels_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
