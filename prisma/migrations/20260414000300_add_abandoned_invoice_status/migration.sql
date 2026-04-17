-- AlterTable: invoices status enum add abandoned
ALTER TABLE `invoices`
  MODIFY `status` ENUM('paid', 'pending', 'overdue', 'partial', 'abandoned', 'inactive') NOT NULL DEFAULT 'pending';
