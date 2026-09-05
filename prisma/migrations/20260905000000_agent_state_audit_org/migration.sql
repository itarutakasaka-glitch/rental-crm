-- CreateEnum
CREATE TYPE "AgentState" AS ENUM ('NONE', 'FIRST_MAIL_PENDING', 'FIRST_MAIL_DRAFTED', 'WAITING_REPLY', 'CLASSIFY_PENDING', 'CLASSIFIED_A', 'CLASSIFIED_B', 'CLASSIFIED_C', 'CONFIRM_PENDING', 'BOOKING_DRAFTED', 'BOOKED', 'MANUAL');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "agentState" "AgentState" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "LinePending" ALTER COLUMN "organizationId" DROP NOT NULL,
ALTER COLUMN "organizationId" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Customer_organizationId_isNeedAction_updatedAt_idx" ON "Customer"("organizationId", "isNeedAction", "updatedAt");

-- CreateIndex
CREATE INDEX "Customer_agentState_idx" ON "Customer"("agentState");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_customerId_createdAt_idx" ON "AuditLog"("customerId", "createdAt");
