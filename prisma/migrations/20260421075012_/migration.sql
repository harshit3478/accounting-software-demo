/*
  Warnings:

  - You are about to alter the column `reason` on the `due_date_reasons` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.

*/
-- AlterTable
ALTER TABLE `due_date_reasons` MODIFY `reason` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `invoices` MODIFY `status` ENUM('paid', 'pending', 'overdue', 'partial', 'abandoned', 'inactive') NOT NULL DEFAULT 'pending';
