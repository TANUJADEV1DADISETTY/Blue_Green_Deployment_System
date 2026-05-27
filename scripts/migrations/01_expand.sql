-- 01_expand.sql: Add new columns as NULL-able
-- This allows both Blue (v1.0) and Green (v2.0) to operate with this schema.

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20) NULL,
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT NULL;
