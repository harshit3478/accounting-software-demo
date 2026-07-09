-- AlterTable
ALTER TABLE `cheque_vault`
    ADD COLUMN `documentType` ENUM('CHEQUE', 'MEMO') NOT NULL DEFAULT 'CHEQUE',
    ADD COLUMN `memoText` TEXT NULL;

-- CreateIndex
CREATE INDEX `cheque_vault_documentType_idx` ON `cheque_vault`(`documentType`);
