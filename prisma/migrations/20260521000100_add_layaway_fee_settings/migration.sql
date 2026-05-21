-- Add layaway fee amount to invoices
ALTER TABLE `invoices`
ADD COLUMN `layawayFee` DECIMAL(10, 2) NOT NULL DEFAULT 0
AFTER `insuranceAmount`;
-- Fixed layaway fee schedule (1-6 months)
CREATE TABLE `layaway_fee_settings` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `months` INT NOT NULL,
    `ratePerGram` DECIMAL(10, 2) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
    `sortOrder` INT NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `layaway_fee_settings_months_key` (`months`),
    INDEX `layaway_fee_settings_isActive_sortOrder_idx` (`isActive`, `sortOrder`)
) ENGINE = InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;