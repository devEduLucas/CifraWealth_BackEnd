-- Compatible with both the original Prisma migration and the legacy local schema.
-- Google accounts have no local password. Existing passwords are preserved.
ALTER TABLE usuarios MODIFY COLUMN senha VARCHAR(255) NULL;
SET @wealth_google_index_sql = (
  SELECT IF(COUNT(*) > 0, 'SELECT 1', 'CREATE UNIQUE INDEX google_id ON usuarios(google_id)')
  FROM information_schema.statistics
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'google_id' AND NON_UNIQUE = 0
);
PREPARE wealth_google_index_stmt FROM @wealth_google_index_sql;
EXECUTE wealth_google_index_stmt;
DEALLOCATE PREPARE wealth_google_index_stmt;
