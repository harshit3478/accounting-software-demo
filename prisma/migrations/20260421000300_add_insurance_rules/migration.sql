CREATE TABLE `insurance_rules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `maxValue` DECIMAL(10, 2) NOT NULL,
    `clientShare` DECIMAL(10, 2) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `insurance_rules_maxValue_key`(`maxValue`),
    INDEX `insurance_rules_sortOrder_idx`(`sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;