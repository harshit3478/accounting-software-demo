-- Customer soft delete
ALTER TABLE `customers` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `customers` ADD COLUMN `deletedAt` DATETIME(3) NULL;
CREATE INDEX `customers_isDeleted_idx` ON `customers`(`isDeleted`);

-- Document soft delete
ALTER TABLE `documents` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `documents` ADD COLUMN `deletedAt` DATETIME(3) NULL;
ALTER TABLE `documents` ADD COLUMN `deletedBy` INTEGER NULL;
CREATE INDEX `documents_isDeleted_idx` ON `documents`(`isDeleted`);

-- Term soft delete via isActive
ALTER TABLE `terms` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX `terms_isActive_idx` ON `terms`(`isActive`);

-- Cheque vault soft delete
ALTER TABLE `cheque_vault` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `cheque_vault` ADD COLUMN `deletedAt` DATETIME(3) NULL;
CREATE INDEX `cheque_vault_isDeleted_idx` ON `cheque_vault`(`isDeleted`);

-- Keep cheque↔invoice links if a cheque row is ever hard-deleted by mistake
ALTER TABLE `cheque_vault_invoices` DROP FOREIGN KEY `cheque_vault_invoices_chequeVaultId_fkey`;
ALTER TABLE `cheque_vault_invoices` ADD CONSTRAINT `cheque_vault_invoices_chequeVaultId_fkey` FOREIGN KEY (`chequeVaultId`) REFERENCES `cheque_vault`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep QB webhook logs if connection row is ever hard-deleted by mistake
ALTER TABLE `quickbooks_webhook_logs` DROP FOREIGN KEY `quickbooks_webhook_logs_connectionId_fkey`;
ALTER TABLE `quickbooks_webhook_logs` ADD CONSTRAINT `quickbooks_webhook_logs_connectionId_fkey` FOREIGN KEY (`connectionId`) REFERENCES `quickbooks_connections`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
