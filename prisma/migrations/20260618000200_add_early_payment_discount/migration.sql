-- AlterTable
ALTER TABLE `invoices` ADD COLUMN `earlyPaymentDiscount` DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `early_payment_discount_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `daysWindow` INTEGER NOT NULL DEFAULT 0,
    `discountPercent` DECIMAL(10, 2) NOT NULL,
    `paymentThreshold` VARCHAR(191) NOT NULL DEFAULT 'full',
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
