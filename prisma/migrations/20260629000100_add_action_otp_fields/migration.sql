-- AlterTable
ALTER TABLE `users` ADD COLUMN `actionOtpCode` VARCHAR(191) NULL,
    ADD COLUMN `actionOtpExpiresAt` DATETIME(3) NULL;
