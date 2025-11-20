-- Placeholder migration file created to satisfy Prisma migration lookup.
-- The original migration directory was empty causing P3015 errors.
-- If you have the intended SQL for this migration, replace this file with the real statements.

/* Update users.role enum to include staff and accountant so seed values are accepted */
ALTER TABLE `users`
	MODIFY COLUMN `role` ENUM('admin','user','viewer','staff','accountant') NOT NULL DEFAULT 'accountant';

-- If there are existing rows with roles outside the desired set, adjust them here.
-- For example, to convert old 'user' to 'accountant' uncomment below:
-- UPDATE `users` SET `role` = 'accountant' WHERE `role` = 'user';
