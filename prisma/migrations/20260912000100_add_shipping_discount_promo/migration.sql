-- AlterTable
ALTER TABLE `unit_discount_settings` ADD COLUMN `kind` VARCHAR(191) NOT NULL DEFAULT 'unit_percent';
ALTER TABLE `unit_discount_settings` ADD COLUMN `name` VARCHAR(191) NOT NULL DEFAULT '';
ALTER TABLE `unit_discount_settings` ADD COLUMN `liveTypeId` INTEGER NULL;
ALTER TABLE `unit_discount_settings` ADD COLUMN `thresholds` JSON NULL;
ALTER TABLE `unit_discount_settings` MODIFY `unitName` VARCHAR(191) NOT NULL DEFAULT '';
ALTER TABLE `unit_discount_settings` MODIFY `discountPercent` DECIMAL(10, 2) NOT NULL DEFAULT 0.00;

-- AlterTable
ALTER TABLE `invoices` ADD COLUMN `shippingDiscountAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE `invoices` ADD COLUMN `shippingDiscountOffer` JSON NULL;

-- CreateIndex
CREATE INDEX `unit_discount_settings_kind_isActive_idx` ON `unit_discount_settings`(`kind`, `isActive`);

-- AddForeignKey
ALTER TABLE `unit_discount_settings` ADD CONSTRAINT `unit_discount_settings_liveTypeId_fkey` FOREIGN KEY (`liveTypeId`) REFERENCES `live_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
