/*
  Warnings:

  - You are about to drop the column `entryDate` on the `regularization_requests` table. All the data in the column will be lost.
  - You are about to alter the column `status` on the `regularization_requests` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(6))`.
  - The values [user,viewer] on the enum `users_role` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[userId,date]` on the table `attendance_entries` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `forDate` to the `regularization_requests` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `attendance_entries` DROP FOREIGN KEY `attendance_entries_userId_fkey`;

-- DropForeignKey
ALTER TABLE `regularization_requests` DROP FOREIGN KEY `regularization_requests_reviewedBy_fkey`;

-- DropForeignKey
ALTER TABLE `regularization_requests` DROP FOREIGN KEY `regularization_requests_userId_fkey`;

-- DropIndex
DROP INDEX `attendance_entries_userId_date_idx` ON `attendance_entries`;

-- DropIndex
DROP INDEX `regularization_requests_reviewedBy_fkey` ON `regularization_requests`;

-- DropIndex
DROP INDEX `regularization_requests_userId_entryDate_idx` ON `regularization_requests`;

-- AlterTable
ALTER TABLE `attendance_entries` ADD COLUMN `totalHours` DECIMAL(6, 2) NULL;

-- AlterTable
ALTER TABLE `regularization_requests` DROP COLUMN `entryDate`,
    ADD COLUMN `forDate` DATETIME(3) NOT NULL,
    ADD COLUMN `type` ENUM('checkin', 'checkout', 'both', 'manual') NOT NULL DEFAULT 'manual',
    MODIFY `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE `users` MODIFY `role` ENUM('admin', 'staff', 'accountant') NOT NULL DEFAULT 'accountant';

-- CreateIndex
CREATE UNIQUE INDEX `attendance_entries_userId_date_key` ON `attendance_entries`(`userId`, `date`);
-- AddForeignKey
ALTER TABLE `regularization_requests` ADD CONSTRAINT `regularization_requests_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
