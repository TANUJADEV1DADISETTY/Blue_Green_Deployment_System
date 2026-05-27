-- 03_contract.sql: Apply breaking changes
-- Modifies phone_number column to be NOT NULL, since Blue environment is retired.

ALTER TABLE users 
ALTER COLUMN phone_number SET NOT NULL;
