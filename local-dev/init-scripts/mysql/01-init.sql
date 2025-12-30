-- MySQL initialization script for e2e tests
-- Creates the test database with proper settings

-- Ensure we have the test database
CREATE DATABASE IF NOT EXISTS qshelter_test
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Grant permissions
GRANT ALL PRIVILEGES ON qshelter_test.* TO 'qshelter'@'%';
FLUSH PRIVILEGES;

-- Use the database
USE qshelter_test;

-- Create a health check table
CREATE TABLE IF NOT EXISTS _health_check (
  id INT PRIMARY KEY DEFAULT 1,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO _health_check (id) VALUES (1) ON DUPLICATE KEY UPDATE checked_at = CURRENT_TIMESTAMP;
