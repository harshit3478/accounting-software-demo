-- AlterTable
ALTER TABLE `invoices` MODIFY `status` ENUM('paid', 'pending', 'overdue', 'partial', 'inactive') NOT NULL DEFAULT 'pending';
