-- Recovery migration for production if 20260620000100 failed mid-way.
-- Safe to run: dedupes emails and ensures the unique index exists.

UPDATE `customers` SET `email` = NULL WHERE `email` IS NOT NULL AND TRIM(`email`) = '';

UPDATE `customers` AS c
INNER JOIN (
  SELECT LOWER(TRIM(`email`)) AS normalized_email, MIN(`id`) AS keep_id
  FROM `customers`
  WHERE `email` IS NOT NULL AND TRIM(`email`) <> ''
  GROUP BY LOWER(TRIM(`email`))
  HAVING COUNT(*) > 1
) AS d ON LOWER(TRIM(c.`email`)) = d.normalized_email AND c.`id` <> d.`keep_id`
SET c.`email` = NULL;

UPDATE `customers` SET `email` = LOWER(TRIM(`email`)) WHERE `email` IS NOT NULL;

UPDATE `customers` AS c
INNER JOIN (
  SELECT `email`, MIN(`id`) AS keep_id
  FROM `customers`
  WHERE `email` IS NOT NULL
  GROUP BY `email`
  HAVING COUNT(*) > 1
) AS d ON c.`email` = d.`email` AND c.`id` <> d.`keep_id`
SET c.`email` = NULL;

SET @idx_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customers'
    AND INDEX_NAME = 'customers_email_key'
);
SET @sql := IF(
  @idx_exists = 0,
  'CREATE UNIQUE INDEX `customers_email_key` ON `customers`(`email`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
