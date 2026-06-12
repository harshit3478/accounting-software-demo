-- AlterTable
ALTER TABLE `cheque_vault`
  ADD COLUMN `rejectedById` INTEGER NULL,
  ADD COLUMN `rejectedAt` DATETIME(3) NULL,
  ADD COLUMN `correctionRequestedById` INTEGER NULL,
  ADD COLUMN `correctionRequestedAt` DATETIME(3) NULL,
  ADD COLUMN `invoicesLinkedById` INTEGER NULL,
  ADD COLUMN `invoicesLinkedAt` DATETIME(3) NULL,
  ADD COLUMN `submittedAt` DATETIME(3) NULL;

-- AddForeignKey
ALTER TABLE `cheque_vault` ADD CONSTRAINT `cheque_vault_rejectedById_fkey` FOREIGN KEY (`rejectedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cheque_vault` ADD CONSTRAINT `cheque_vault_correctionRequestedById_fkey` FOREIGN KEY (`correctionRequestedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cheque_vault` ADD CONSTRAINT `cheque_vault_invoicesLinkedById_fkey` FOREIGN KEY (`invoicesLinkedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
