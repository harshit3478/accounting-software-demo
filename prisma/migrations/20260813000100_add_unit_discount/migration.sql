-- AlterTable
ALTER TABLE `invoices` ADD COLUMN `unitDiscountAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE `invoices` ADD COLUMN `unitDiscountOffer` JSON NULL;

-- CreateTable
CREATE TABLE `unit_discount_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitName` VARCHAR(191) NOT NULL,
    `discountPercent` DECIMAL(10, 2) NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `paymentDueDate` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `unit_discount_settings_unitName_isActive_idx`(`unitName`, `isActive`),
    INDEX `unit_discount_settings_isActive_periodStart_periodEnd_idx`(`isActive`, `periodStart`, `periodEnd`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `unit_discount_settings` ADD CONSTRAINT `unit_discount_settings_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
