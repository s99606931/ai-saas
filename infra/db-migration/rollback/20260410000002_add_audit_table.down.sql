-- 롤백: 감사 로그 확장
-- Design Ref: §2.4 | Plan SC: FR-N150.4
DROP TABLE IF EXISTS migration_audit;
DROP INDEX IF EXISTS idx_audit_logs_correlation;
DROP INDEX IF EXISTS idx_audit_logs_severity;
ALTER TABLE audit_logs DROP COLUMN IF EXISTS correlation_id;
ALTER TABLE audit_logs DROP COLUMN IF EXISTS session_id;
ALTER TABLE audit_logs DROP COLUMN IF EXISTS severity;
