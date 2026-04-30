-- AlterTable
ALTER TABLE `payments`
ADD COLUMN `paymentCode` VARCHAR(191) NULL;
-- Backfill existing payment codes from the primary key
UPDATE `payments`
SET `paymentCode` = CONCAT('PAY-', LPAD(`id`, 6, '0'))
WHERE `paymentCode` IS NULL;
-- CreateIndex
CREATE UNIQUE INDEX `payments_paymentCode_key` ON `payments`(`paymentCode`);