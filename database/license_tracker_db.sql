-- SQL Script for License Tracker Database Setup (Version 3)

-- 1. Create the database if it doesn't exist
CREATE DATABASE IF NOT EXISTS `license_tracker_db`;
USE `license_tracker_db`;

-- 2. Create the 'users' table (No Change)
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(255) NOT NULL UNIQUE,
    `password` VARCHAR(255) NOT NULL, -- Store hashed passwords in production!
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert a default admin user (Only if not already present)
INSERT INTO `users` (`username`, `password`) VALUES
('admin', 'password')
ON DUPLICATE KEY UPDATE username=username;

-- 3. Create or ALTER the 'licenses' table to change to `attachment_data` (LONGTEXT for Base64)
-- If you are running this on an existing database:
--    First, remove the old column if it exists:
--    ALTER TABLE `licenses` DROP COLUMN `attachment_url`;
--    Then, add the new column:
--    ALTER TABLE `licenses` ADD COLUMN `attachment_data` LONGTEXT AFTER `removal_details_json`;
--
-- If starting fresh, you can run this CREATE TABLE statement:
CREATE TABLE IF NOT EXISTS `licenses` (
    `id` VARCHAR(36) PRIMARY KEY, -- Using VARCHAR(36) for UUIDs
    `ticket_id` VARCHAR(255) NOT NULL,
    `system` VARCHAR(50) NOT NULL, -- e.g., 'DMS', 'LSQ', 'CRM', 'ZOHO'
    `name` VARCHAR(255) NOT NULL,
    `mobile` VARCHAR(20),
    `email` VARCHAR(255),
    `request_type` VARCHAR(50) NOT NULL, -- 'Add License' or 'Modify License'
    `assignment_date` DATE NOT NULL,
    `expiry_date` DATE,
    `status` VARCHAR(50) DEFAULT 'Active', -- 'Active', 'Inactive'
    `details_json` TEXT, -- Stores JSON string for system-specific fields (e.g., DMS, LSQ data)
    `removal_details_json` TEXT, -- Stores JSON string for removal info (ticketId, date, reason, remover)
    `attachment_data` LONGTEXT, -- NEW: Stores Base64 encoded file data
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


-- 4. Create the 'tickets' table (No Change)
CREATE TABLE IF NOT EXISTS `tickets` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `ticket_id` VARCHAR(255) NOT NULL, -- Corresponds to ticket_id from licenses table
    `action_description` TEXT NOT NULL, -- e.g., "Add License for John Doe (CRM)"
    `status` VARCHAR(50) DEFAULT 'Open', -- 'Open', 'Pending', 'Closed'
    `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- You might want to add indexes for performance on frequently queried columns (No Change)
CREATE INDEX idx_licenses_system ON `licenses` (`system`);
CREATE INDEX idx_licenses_name ON `licenses` (`name`);
CREATE INDEX idx_licenses_email ON `licenses` (`email`);
CREATE INDEX idx_licenses_mobile ON `licenses` (`mobile`);
CREATE INDEX idx_tickets_ticket_id ON `tickets` (`ticket_id`);