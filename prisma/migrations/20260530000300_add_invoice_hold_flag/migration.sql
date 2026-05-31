-- AlterTable
ALTER TABLE `invoices`
ADD COLUMN `isHold` BOOLEAN NOT NULL DEFAULT false;