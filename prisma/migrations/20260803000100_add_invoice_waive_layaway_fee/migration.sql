-- AlterTable (MySQL — idempotent for interrupted deploy recovery)
SET @col_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'waiveLayawayFee'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `invoices` ADD COLUMN `waiveLayawayFee` BOOLEAN NOT NULL DEFAULT false',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
