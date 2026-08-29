-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "lockedByUserId" TEXT,
ADD COLUMN     "lockedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
