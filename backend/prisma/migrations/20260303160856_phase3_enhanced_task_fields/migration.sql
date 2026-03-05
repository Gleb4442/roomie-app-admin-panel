-- AlterTable
ALTER TABLE "hotel_tms_configs" ADD COLUMN     "departmentMappings" JSONB,
ADD COLUMN     "escalationChain" JSONB,
ADD COLUMN     "hybridCategorySlugs" TEXT[],
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'BUILT_IN',
ADD COLUMN     "outgoingWebhookUrl" TEXT,
ADD COLUMN     "pollingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pollingIntervalMs" INTEGER NOT NULL DEFAULT 30000,
ADD COLUMN     "slaConfig" JSONB,
ADD COLUMN     "staffMappings" JSONB,
ADD COLUMN     "webhookSecret" TEXT;

-- AlterTable
ALTER TABLE "internal_tasks" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "assigneeGroupId" TEXT,
ADD COLUMN     "chatMessageId" TEXT,
ADD COLUMN     "cost" DECIMAL(65,30),
ADD COLUMN     "currency" TEXT DEFAULT 'UAH',
ADD COLUMN     "escalationLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "etaMinutes" INTEGER,
ADD COLUMN     "etaUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "externalTmsId" TEXT,
ADD COLUMN     "externalTmsType" TEXT,
ADD COLUMN     "isBillable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ratedAt" TIMESTAMP(3),
ADD COLUMN     "rating" INTEGER,
ADD COLUMN     "ratingComment" TEXT,
ADD COLUMN     "slaBreached" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'STAFF',
ADD COLUMN     "syncStatus" TEXT NOT NULL DEFAULT 'NOT_SYNCED';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "chatMessageId" TEXT,
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "escalationLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "etaMinutes" INTEGER,
ADD COLUMN     "etaUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "ratedAt" TIMESTAMP(3),
ADD COLUMN     "rating" INTEGER,
ADD COLUMN     "ratingComment" TEXT,
ADD COLUMN     "slaBreached" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slaMinutes" INTEGER,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'BUTTON',
ADD COLUMN     "syncStatus" TEXT NOT NULL DEFAULT 'NOT_SYNCED';

-- AlterTable
ALTER TABLE "service_categories" ADD COLUMN     "defaultEtaMinutes" INTEGER,
ADD COLUMN     "slaMinutes" INTEGER,
ADD COLUMN     "slaWarningMinutes" INTEGER;

-- AlterTable
ALTER TABLE "service_requests" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "assigneeGroupId" TEXT,
ADD COLUMN     "chatMessageId" TEXT,
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "escalationLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "etaMinutes" INTEGER,
ADD COLUMN     "etaUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "ratedAt" TIMESTAMP(3),
ADD COLUMN     "rating" INTEGER,
ADD COLUMN     "ratingComment" TEXT,
ADD COLUMN     "slaBreached" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slaMinutes" INTEGER,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'BUTTON',
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "syncStatus" TEXT NOT NULL DEFAULT 'NOT_SYNCED';
