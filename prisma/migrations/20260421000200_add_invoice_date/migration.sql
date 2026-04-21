ALTER TABLE `invoices`
ADD COLUMN `invoiceDate` DATETIME(3) NULL;
UPDATE `invoices`
SET `invoiceDate` = `createdAt`
WHERE `invoiceDate` IS NULL;
ALTER TABLE `invoices`
MODIFY `invoiceDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);