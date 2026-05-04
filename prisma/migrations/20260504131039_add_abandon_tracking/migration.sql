-- AlterTable
ALTER TABLE `payments` ADD COLUMN `abandonReason` TEXT NULL,
    ADD COLUMN `abandonedAt` DATETIME(3) NULL,
    ADD COLUMN `abandonedBy` INTEGER NULL;
