-- Add unit-scoped layaway fee config
ALTER TABLE `layaway_fee_settings`
ADD COLUMN `unitName` VARCHAR(191) NOT NULL DEFAULT 'grams'
AFTER `id`;
-- Remove the old month-only uniqueness so each unit can have its own 1-6 month schedule
ALTER TABLE `layaway_fee_settings` DROP INDEX `layaway_fee_settings_months_key`,
    ADD UNIQUE INDEX `layaway_fee_settings_unitName_months_key` (`unitName`, `months`),
    DROP INDEX `layaway_fee_settings_isActive_sortOrder_idx`,
    ADD INDEX `layaway_fee_settings_isActive_sortOrder_idx` (`isActive`, `sortOrder`);