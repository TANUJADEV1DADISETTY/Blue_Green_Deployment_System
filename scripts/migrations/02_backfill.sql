-- 02_backfill.sql: Populate NULL values in the new columns with default values
-- This prepares the schema for the contract phase where these could become NOT NULL.

UPDATE users 
SET phone_number = '000-000-0000' 
WHERE phone_number IS NULL;

UPDATE users 
SET profile_picture_url = 'https://example.com/default.png' 
WHERE profile_picture_url IS NULL;
