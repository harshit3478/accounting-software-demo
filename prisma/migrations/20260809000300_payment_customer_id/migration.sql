-- AlterTable
ALTER TABLE `payments` ADD COLUMN `customerId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `payments_customerId_idx` ON `payments`(`customerId`);

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
