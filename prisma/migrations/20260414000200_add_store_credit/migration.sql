-- AlterTable: customers
ALTER TABLE `customers`
    ADD COLUMN `storeCredit` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- CreateTable: customer_credit_transactions
CREATE TABLE `customer_credit_transactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customerId` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'credit',
    `reason` TEXT NULL,
    `paymentId` INTEGER NULL,
    `invoiceId` INTEGER NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `customer_credit_transactions_customerId_createdAt_idx`(`customerId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `customer_credit_transactions`
    ADD CONSTRAINT `customer_credit_transactions_customerId_fkey`
    FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_credit_transactions`
    ADD CONSTRAINT `customer_credit_transactions_paymentId_fkey`
    FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_credit_transactions`
    ADD CONSTRAINT `customer_credit_transactions_invoiceId_fkey`
    FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_credit_transactions`
    ADD CONSTRAINT `customer_credit_transactions_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
