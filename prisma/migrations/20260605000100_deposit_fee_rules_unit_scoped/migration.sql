-- Scope deposit fee rules by unit quantity bands instead of item price bands
ALTER TABLE `deposit_fee_rules`
ADD COLUMN `unitName` VARCHAR(191) NOT NULL DEFAULT 'grams' AFTER `name`;

ALTER TABLE `deposit_fee_rules`
CHANGE COLUMN `minAmount` `minUnit` DECIMAL(10, 2) NULL,
CHANGE COLUMN `maxAmount` `maxUnit` DECIMAL(10, 2) NULL;

ALTER TABLE `deposit_fee_rules`
ADD INDEX `deposit_fee_rules_unitName_isActive_sortOrder_idx` (`unitName`, `isActive`, `sortOrder`);
