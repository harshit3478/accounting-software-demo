-- CreateTable: shipping_fee_rules
CREATE TABLE `shipping_fee_rules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `minAmount` DECIMAL(10, 2) NULL,
    `maxAmount` DECIMAL(10, 2) NULL,
    `fee` DECIMAL(10, 2) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdBy` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `shipping_fee_rules_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable: invoices
ALTER TABLE `invoices`
    ADD COLUMN `shippingFee` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `shippingFeeRuleId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `shipping_fee_rules`
    ADD CONSTRAINT `shipping_fee_rules_createdBy_fkey`
    FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices`
    ADD CONSTRAINT `invoices_shippingFeeRuleId_fkey`
    FOREIGN KEY (`shippingFeeRuleId`) REFERENCES `shipping_fee_rules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
