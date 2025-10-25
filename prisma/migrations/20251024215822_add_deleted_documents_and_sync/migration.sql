/*
  Warnings:

  - You are about to alter the column `method` on the `payments` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(2))`.
  - You are about to alter the column `role` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(0))` to `Enum(EnumId(0))`.
  - A unique constraint covering the columns `[invoiceNumber]` on the table `invoices` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[quickbooksId]` on the table `payments` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `invoiceNumber` to the `invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotal` to the `invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `payments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `invoices` ADD COLUMN `discount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `invoiceNumber` VARCHAR(191) NOT NULL,
    ADD COLUMN `isLayaway` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `items` JSON NULL,
    ADD COLUMN `paidAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `subtotal` DECIMAL(10, 2) NOT NULL,
    ADD COLUMN `tax` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `payments` ADD COLUMN `isMatched` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `notes` TEXT NULL,
    ADD COLUMN `quickbooksId` VARCHAR(191) NULL,
    ADD COLUMN `quickbooksSyncedAt` DATETIME(3) NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    MODIFY `invoiceId` INTEGER NULL,
    MODIFY `method` ENUM('cash', 'zelle', 'quickbooks', 'layaway') NOT NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `privileges` JSON NULL,
    MODIFY `role` ENUM('admin', 'accountant') NOT NULL DEFAULT 'accountant';

-- CreateTable
CREATE TABLE `payment_invoice_matches` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `paymentId` INTEGER NOT NULL,
    `invoiceId` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `payment_invoice_matches_paymentId_invoiceId_key`(`paymentId`, `invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deleted_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `originalDocId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `fileSize` BIGINT NOT NULL,
    `fileType` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL,
    `deletedBy` INTEGER NOT NULL,
    `deletedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleteReason` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `invoices_invoiceNumber_key` ON `invoices`(`invoiceNumber`);

-- CreateIndex
CREATE UNIQUE INDEX `payments_quickbooksId_key` ON `payments`(`quickbooksId`);

-- AddForeignKey
ALTER TABLE `payment_invoice_matches` ADD CONSTRAINT `payment_invoice_matches_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_invoice_matches` ADD CONSTRAINT `payment_invoice_matches_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_invoice_matches` ADD CONSTRAINT `payment_invoice_matches_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deleted_documents` ADD CONSTRAINT `deleted_documents_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deleted_documents` ADD CONSTRAINT `deleted_documents_deletedBy_fkey` FOREIGN KEY (`deletedBy`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
