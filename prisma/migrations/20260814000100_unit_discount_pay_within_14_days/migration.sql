-- Unit discount pay-by is invoice date + 14 days, not a configured due date.
ALTER TABLE `unit_discount_settings` DROP COLUMN `paymentDueDate`;
