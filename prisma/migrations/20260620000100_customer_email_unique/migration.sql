-- Normalize customer emails before adding unique constraint
UPDATE `customers` SET `email` = NULL WHERE `email` IS NOT NULL AND TRIM(`email`) = '';

UPDATE `customers` SET `email` = LOWER(TRIM(`email`)) WHERE `email` IS NOT NULL;

-- Keep the oldest customer per email; clear duplicates so migration can succeed
UPDATE `customers` AS c
INNER JOIN (
  SELECT `email`, MIN(`id`) AS `keep_id`
  FROM `customers`
  WHERE `email` IS NOT NULL
  GROUP BY `email`
  HAVING COUNT(*) > 1
) AS d ON c.`email` = d.`email` AND c.`id` <> d.`keep_id`
SET c.`email` = NULL;

-- CreateIndex
CREATE UNIQUE INDEX `customers_email_key` ON `customers`(`email`);
