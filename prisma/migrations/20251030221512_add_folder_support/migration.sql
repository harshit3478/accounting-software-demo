-- Add folder support to documents table (SHARED STORAGE)
-- Migration created: October 31, 2025

-- Step 1: Add new columns for folder hierarchy
ALTER TABLE `documents` 
  ADD COLUMN `type` ENUM('file', 'folder') NOT NULL DEFAULT 'file' AFTER `userId`,
  ADD COLUMN `name` VARCHAR(255) NULL AFTER `type`,
  ADD COLUMN `parentId` INT NULL AFTER `fileUrl`,
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) AFTER `uploadedAt`;

-- Step 2: Copy originalName to name for existing files
UPDATE `documents` SET `name` = `originalName` WHERE `name` IS NULL;

-- Step 3: Make name NOT NULL after data migration
ALTER TABLE `documents` 
  MODIFY COLUMN `name` VARCHAR(255) NOT NULL;

-- Step 4: Make file-specific columns nullable (folders don't have these)
ALTER TABLE `documents` 
  MODIFY COLUMN `fileName` VARCHAR(255) NULL,
  MODIFY COLUMN `fileSize` BIGINT NULL,
  MODIFY COLUMN `fileType` VARCHAR(255) NULL,
  MODIFY COLUMN `fileUrl` TEXT NULL;

-- Step 5: Add indexes for performance (SHARED STORAGE - no userId in indexes!)
ALTER TABLE `documents`
  ADD INDEX `idx_parent` (`parentId`),
  ADD INDEX `idx_type_parent` (`type`, `parentId`);

-- Step 6: Add self-referencing foreign key for hierarchy
ALTER TABLE `documents` 
  ADD CONSTRAINT `fk_document_parent` 
  FOREIGN KEY (`parentId`) 
  REFERENCES `documents`(`id`) 
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- Step 7: Update deleted_documents table for folder support
ALTER TABLE `deleted_documents`
  ADD COLUMN `type` ENUM('file', 'folder') NOT NULL DEFAULT 'file' AFTER `userId`,
  ADD COLUMN `name` VARCHAR(255) NULL AFTER `type`,
  ADD COLUMN `folderContents` JSON NULL AFTER `name`,
  ADD COLUMN `originalParentId` INT NULL AFTER `folderContents`,
  ADD COLUMN `parentPath` VARCHAR(1000) NULL AFTER `originalParentId`;

-- Step 8: Copy originalName to name in deleted_documents
UPDATE `deleted_documents` SET `name` = `originalName` WHERE `name` IS NULL;

-- Step 9: Make name NOT NULL in deleted_documents
ALTER TABLE `deleted_documents`
  MODIFY COLUMN `name` VARCHAR(255) NOT NULL;

-- Step 10: Make file columns nullable in deleted_documents
ALTER TABLE `deleted_documents`
  MODIFY COLUMN `fileName` VARCHAR(255) NULL,
  MODIFY COLUMN `fileSize` BIGINT NULL,
  MODIFY COLUMN `fileType` VARCHAR(255) NULL,
  MODIFY COLUMN `fileUrl` TEXT NULL;

-- Step 11: Drop system_folders table (deprecated with new hierarchy)
DROP TABLE IF EXISTS `system_folders`;

-- Migration complete!
-- All existing documents are now root-level files (parentId = NULL, type = 'file')
-- Ready for folder creation via API