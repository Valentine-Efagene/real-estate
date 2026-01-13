-- MySQL initialization script for e2e tests
-- Creates the test database with proper settings

-- Ensure we have the test database
CREATE DATABASE IF NOT EXISTS qshelter_test
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Grant permissions on qshelter_test database
GRANT ALL PRIVILEGES ON qshelter_test.* TO 'qshelter'@'%';

-- Grant permissions to create/drop shadow databases (required by Prisma Migrate)
-- Prisma creates shadow databases named like: prisma_migrate_shadow_db_*
GRANT CREATE, DROP ON *.* TO 'qshelter'@'%';
GRANT ALL PRIVILEGES ON `prisma_migrate_shadow_db_%`.* TO 'qshelter'@'%';

FLUSH PRIVILEGES;

-- Use the database
USE qshelter_test;

-- Create a health check table
CREATE TABLE IF NOT EXISTS _health_check (
  id INT PRIMARY KEY DEFAULT 1,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO _health_check (id) VALUES (1) ON DUPLICATE KEY UPDATE checked_at = CURRENT_TIMESTAMP;
