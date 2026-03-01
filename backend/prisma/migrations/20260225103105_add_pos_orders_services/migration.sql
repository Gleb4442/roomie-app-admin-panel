-- CreateEnum
CREATE TYPE "ServiceSource" AS ENUM ('MANUAL', 'POS_SYNC');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('FOOD', 'HOUSEKEEPING', 'SPA', 'TRANSPORT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'SENT_TO_POS', 'CONFIRMED', 'PREPARING', 'READY', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "guest_stays" ADD COLUMN     "preCheckinCompleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "hotel_pms_configs" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "pmsType" TEXT NOT NULL,
    "credentials" JSONB NOT NULL,
    "pmsHotelId" TEXT,
    "syncMode" TEXT NOT NULL DEFAULT 'DISABLED',
    "lastSyncAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "preCheckinUrl" TEXT,

    CONSTRAINT "hotel_pms_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_pos_configs" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "posType" TEXT NOT NULL,
    "apiUrl" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "spotId" TEXT,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "syncInterval" INTEGER NOT NULL DEFAULT 60,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "categoryMap" JSONB,

    CONSTRAINT "hotel_pos_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_services" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "imageUrl" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "cookingTime" INTEGER,
    "source" "ServiceSource" NOT NULL DEFAULT 'MANUAL',
    "posItemId" TEXT,
    "posCategory" TEXT,
    "posData" JSONB,
    "lastSyncAt" TIMESTAMP(3),

    CONSTRAINT "hotel_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "type" "OrderType" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "roomNumber" TEXT,
    "specialInstructions" TEXT,
    "deliveryTime" TEXT,
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "posOrderId" TEXT,
    "posStatus" TEXT,
    "posTransactionId" TEXT,
    "maxCookingTime" INTEGER,
    "estimatedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "preparingAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "inTransitAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(65,30) NOT NULL,
    "modifiers" JSONB,
    "notes" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hotel_pms_configs_hotelId_key" ON "hotel_pms_configs"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_pos_configs_hotelId_key" ON "hotel_pos_configs"("hotelId");

-- CreateIndex
CREATE INDEX "hotel_services_hotelId_category_isAvailable_idx" ON "hotel_services"("hotelId", "category", "isAvailable");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_services_hotelId_posItemId_key" ON "hotel_services"("hotelId", "posItemId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_guestId_hotelId_idx" ON "orders"("guestId", "hotelId");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_posOrderId_idx" ON "orders"("posOrderId");

-- AddForeignKey
ALTER TABLE "hotel_pms_configs" ADD CONSTRAINT "hotel_pms_configs_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_pos_configs" ADD CONSTRAINT "hotel_pos_configs_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_services" ADD CONSTRAINT "hotel_services_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guest_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "hotel_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
