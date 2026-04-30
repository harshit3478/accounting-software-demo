-- AlterTable
ALTER TABLE `layaway_installments` ADD COLUMN `paymentId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `layaway_installments_paymentId_idx` ON `layaway_installments`(`paymentId`);

-- AddForeignKey
ALTER TABLE `layaway_installments` ADD CONSTRAINT `layaway_installments_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
