-- AlterTable (MySQL — idempotent for interrupted deploy recovery)
SET @col_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'processingFee'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `invoices` ADD COLUMN `processingFee` DECIMAL(10,2) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
