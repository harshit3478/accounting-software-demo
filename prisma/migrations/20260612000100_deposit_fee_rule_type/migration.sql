ALTER TABLE `deposit_fee_rules`
    ADD COLUMN `ruleType` VARCHAR(191) NOT NULL DEFAULT 'range',
    ADD COLUMN `isPercentage` BOOLEAN NOT NULL DEFAULT false;
