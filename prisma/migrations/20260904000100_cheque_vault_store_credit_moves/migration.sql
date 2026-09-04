-- Store credit moves from unallocated cheque amounts (manual action with notes/history)
CREATE TABLE `cheque_vault_store_credit_moves` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `chequeVaultId` INTEGER NOT NULL,
    `customerId` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `notes` TEXT NOT NULL,
    `paymentId` INTEGER NULL,
    `movedById` INTEGER NOT NULL,
    `movedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `cheque_vault_store_credit_moves_chequeVaultId_movedAt_idx`(`chequeVaultId`, `movedAt`),
    INDEX `cheque_vault_store_credit_moves_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `cheque_vault_store_credit_moves`
ADD CONSTRAINT `cheque_vault_store_credit_moves_chequeVaultId_fkey`
FOREIGN KEY (`chequeVaultId`) REFERENCES `cheque_vault`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `cheque_vault_store_credit_moves`
ADD CONSTRAINT `cheque_vault_store_credit_moves_customerId_fkey`
FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `cheque_vault_store_credit_moves`
ADD CONSTRAINT `cheque_vault_store_credit_moves_paymentId_fkey`
FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `cheque_vault_store_credit_moves`
ADD CONSTRAINT `cheque_vault_store_credit_moves_movedById_fkey`
FOREIGN KEY (`movedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
