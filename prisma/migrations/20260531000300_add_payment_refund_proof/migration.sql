ALTER TABLE `payments`
    ADD COLUMN `refundProofUrl` VARCHAR(500) NULL,
    ADD COLUMN `refundProofFileName` VARCHAR(255) NULL;