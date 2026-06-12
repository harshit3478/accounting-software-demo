-- CreateTable
CREATE TABLE `migrated_invoice_edit_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `migrated_invoice_edit_settings` (`isActive`, `updatedAt`)
VALUES (false, CURRENT_TIMESTAMP(3));
