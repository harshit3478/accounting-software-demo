-- AlterTable
ALTER TABLE `invoices`
ADD COLUMN IF NOT EXISTS `liveTypeId` INTEGER NULL,
    ADD COLUMN IF NOT EXISTS `liveTypeSnapshot` VARCHAR(255) NULL;
-- CreateTable
CREATE TABLE IF NOT EXISTS `live_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdBy` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `live_types_name_key`(`name`),
    INDEX `live_types_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE IF NOT EXISTS `cheque_vault` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `chequeNumber` VARCHAR(191) NOT NULL,
    `payeeName` VARCHAR(191) NOT NULL,
    `customerEmail` VARCHAR(191) NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `chequeDate` DATETIME(3) NOT NULL,
    `bankName` VARCHAR(191) NULL,
    `imageUrl` VARCHAR(191) NOT NULL,
    `imageFileName` VARCHAR(191) NOT NULL,
    `rawOcrText` TEXT NULL,
    `status` ENUM(
        'PENDING',
        'APPROVED',
        'REJECTED',
        'NEEDS_CORRECTION'
    ) NOT NULL DEFAULT 'PENDING',
    `uploadedById` INTEGER NOT NULL,
    `approvedById` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectionReason` TEXT NULL,
    `correctionNote` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `cheque_vault_chequeNumber_idx`(`chequeNumber`),
    INDEX `cheque_vault_status_idx`(`status`),
    INDEX `cheque_vault_uploadedById_status_idx`(`uploadedById`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE IF NOT EXISTS `cheque_vault_invoices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `chequeVaultId` INTEGER NOT NULL,
    `invoiceId` INTEGER NOT NULL,
    `allocatedAmount` DECIMAL(10, 2) NOT NULL,
    UNIQUE INDEX `cheque_vault_invoices_chequeVaultId_invoiceId_key`(`chequeVaultId`, `invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- AddForeignKey
ALTER TABLE `invoices`
ADD CONSTRAINT `invoices_liveTypeId_fkey` FOREIGN KEY (`liveTypeId`) REFERENCES `live_types`(`id`) ON DELETE
SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `live_types`
ADD CONSTRAINT `live_types_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `cheque_vault`
ADD CONSTRAINT `cheque_vault_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `cheque_vault`
ADD CONSTRAINT `cheque_vault_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `users`(`id`) ON DELETE
SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `cheque_vault_invoices`
ADD CONSTRAINT `cheque_vault_invoices_chequeVaultId_fkey` FOREIGN KEY (`chequeVaultId`) REFERENCES `cheque_vault`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `cheque_vault_invoices`
ADD CONSTRAINT `cheque_vault_invoices_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;