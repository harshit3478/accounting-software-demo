/*
  Warnings:

  - You are about to alter the column `name` on the `deleted_documents` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `fileName` on the `deleted_documents` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `fileType` on the `deleted_documents` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `name` on the `documents` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `fileName` on the `documents` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to alter the column `fileType` on the `documents` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.

*/
-- DropForeignKey
ALTER TABLE `documents` DROP FOREIGN KEY `fk_document_parent`;

-- AlterTable
ALTER TABLE `deleted_documents` MODIFY `name` VARCHAR(191) NOT NULL,
    MODIFY `fileName` VARCHAR(191) NULL,
    MODIFY `originalName` VARCHAR(191) NULL,
    MODIFY `fileType` VARCHAR(191) NULL,
    MODIFY `fileUrl` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `documents` MODIFY `name` VARCHAR(191) NOT NULL,
    MODIFY `fileName` VARCHAR(191) NULL,
    MODIFY `originalName` VARCHAR(191) NULL,
    MODIFY `fileType` VARCHAR(191) NULL,
    MODIFY `fileUrl` VARCHAR(191) NULL,
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
