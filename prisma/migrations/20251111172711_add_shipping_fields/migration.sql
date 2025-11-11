-- AlterTable
ALTER TABLE `invoices` ADD COLUMN `shipmentId` VARCHAR(255) NULL,
    ADD COLUMN `trackingNumber` VARCHAR(255) NULL;
