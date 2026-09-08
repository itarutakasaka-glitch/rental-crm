-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('EMAIL', 'LINE', 'SMS');

-- CreateTable
CREATE TABLE "OrganizationChannel" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT,
    "type" "ChannelType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "fromName" TEXT,
    "fromAddress" TEXT,
    "lineChannelId" TEXT,
    "lineBasicId" TEXT,
    "smsFromNumber" TEXT,
    "secretEnc" TEXT,
    "webhookSecretEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationChannel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationChannel_organizationId_type_idx" ON "OrganizationChannel"("organizationId", "type");

-- CreateIndex
CREATE INDEX "OrganizationChannel_lineChannelId_idx" ON "OrganizationChannel"("lineChannelId");

-- 部分ユニークインデックス（Prisma schema では表現できないため SQL で定義）
-- Postgres は NULL 同士を「異なる値」として扱うため、単純な複合 UNIQUE では
-- storeId IS NULL の行が重複できてしまう。会社レベル／店舗レベルを別々に一意にする。
CREATE UNIQUE INDEX "OrganizationChannel_org_type_key"
  ON "OrganizationChannel"("organizationId", "type") WHERE "storeId" IS NULL;

CREATE UNIQUE INDEX "OrganizationChannel_org_store_type_key"
  ON "OrganizationChannel"("organizationId", "storeId", "type") WHERE "storeId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "OrganizationChannel" ADD CONSTRAINT "OrganizationChannel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationChannel" ADD CONSTRAINT "OrganizationChannel_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
