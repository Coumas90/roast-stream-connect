-- Template migration for heavy DDL operations
-- Sets local timeouts to prevent long-running locks and statements

-- Set session-local timeouts for this migration only
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10min';

-- Template ready for future heavy DDL operations
-- Copy these timeout settings to the beginning of migrations that include:
-- - CREATE INDEX operations
-- - ALTER TABLE operations with many rows
-- - Complex schema changes
-- - Operations that might hold locks for extended periods

SELECT 'Template migration completed - timeout settings applied for session' AS status;