-- AlterTable: make email optional, add phoneVerified
ALTER TABLE "guest_accounts" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "guest_accounts" ADD COLUMN IF NOT EXISTS "phoneVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex: unique phone
CREATE UNIQUE INDEX IF NOT EXISTS "guest_accounts_phone_key" ON "guest_accounts"("phone");
