-- Exact CREATE TABLE statements pulled from the database for
-- `attendance_entries` and `regularization_requests`.

CREATE TABLE `attendance_entries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `date` datetime(3) NOT NULL,
  `checkIn` datetime(3) DEFAULT NULL,
  `checkOut` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `attendance_entries_userId_date_idx` (`userId`,`date`),
  CONSTRAINT `attendance_entries_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `regularization_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `entryDate` datetime(3) NOT NULL,
  `requestedCheckIn` datetime(3) DEFAULT NULL,
  `requestedCheckOut` datetime(3) DEFAULT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `reviewedBy` int DEFAULT NULL,
  `reviewedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `regularization_requests_userId_entryDate_idx` (`userId`,`entryDate`),
  KEY `regularization_requests_reviewedBy_fkey` (`reviewedBy`),
  CONSTRAINT `regularization_requests_reviewedBy_fkey` FOREIGN KEY (`reviewedBy`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `regularization_requests_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
