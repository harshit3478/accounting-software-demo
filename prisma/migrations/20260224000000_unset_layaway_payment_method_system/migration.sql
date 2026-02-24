-- Remove "system" protection from the Layaway payment method so it can be deleted from the UI.
-- Layaway is an invoice billing structure, not a payment channel.
UPDATE `payment_methods` SET `isSystem` = false WHERE `name` = 'Layaway';
