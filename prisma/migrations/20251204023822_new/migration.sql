-- AddForeignKey
ALTER TABLE `attendance_entries` ADD CONSTRAINT `attendance_entries_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
