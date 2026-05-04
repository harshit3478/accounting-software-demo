-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_abandonedBy_fkey` FOREIGN KEY (`abandonedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
