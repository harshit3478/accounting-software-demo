-- AlterTable
ALTER TABLE `invoices` ADD COLUMN `dueReminderCount` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `invoices` ADD COLUMN `lastDueReminderAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `due_reminder_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `daysAfterDueDate` INTEGER NOT NULL DEFAULT 1,
    `daysBetweenReminders` INTEGER NOT NULL DEFAULT 7,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_due_reminder_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoiceId` INTEGER NOT NULL,
    `reminderNumber` INTEGER NOT NULL,
    `recipientEmail` VARCHAR(191) NOT NULL,
    `success` BOOLEAN NOT NULL DEFAULT true,
    `errorMessage` TEXT NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `invoice_due_reminder_logs_invoiceId_sentAt_idx`(`invoiceId`, `sentAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `invoice_due_reminder_logs` ADD CONSTRAINT `invoice_due_reminder_logs_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
