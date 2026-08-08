-- Soft-delete support for users
ALTER TABLE `users` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `users` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- Prevent hard-deleting a user from cascading financial / document history
ALTER TABLE `invoices` DROP FOREIGN KEY `invoices_userId_fkey`;
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `payments` DROP FOREIGN KEY `payments_userId_fkey`;
ALTER TABLE `payments` ADD CONSTRAINT `payments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `payment_invoice_matches` DROP FOREIGN KEY `payment_invoice_matches_userId_fkey`;
ALTER TABLE `payment_invoice_matches` ADD CONSTRAINT `payment_invoice_matches_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `documents` DROP FOREIGN KEY `documents_userId_fkey`;
ALTER TABLE `documents` ADD CONSTRAINT `documents_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `invoice_edit_history` DROP FOREIGN KEY `invoice_edit_history_editedById_fkey`;
ALTER TABLE `invoice_edit_history` ADD CONSTRAINT `invoice_edit_history_editedById_fkey` FOREIGN KEY (`editedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `payment_edit_history` DROP FOREIGN KEY `payment_edit_history_editedById_fkey`;
ALTER TABLE `payment_edit_history` ADD CONSTRAINT `payment_edit_history_editedById_fkey` FOREIGN KEY (`editedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
