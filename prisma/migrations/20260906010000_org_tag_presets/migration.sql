-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "tagPresets" TEXT[] DEFAULT ARRAY[]::TEXT[];
