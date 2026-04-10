-- 감사 로그 테이블 확장 (N2SF N-06)
-- Design Ref: §2.2 | Plan SC: FR-N150.2

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'INFO';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS correlation_id UUID;

CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation ON audit_logs(correlation_id);

-- 마이그레이션 실행 감사 테이블
CREATE TABLE IF NOT EXISTS migration_audit (
    id BIGSERIAL PRIMARY KEY,
    migration_version VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL,  -- APPLY, ROLLBACK, DRY_RUN
    status VARCHAR(20) NOT NULL,  -- SUCCESS, FAILED, SKIPPED
    executed_by VARCHAR(100) NOT NULL,
    environment VARCHAR(20) NOT NULL,
    execution_time_ms INT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_migration_audit_version ON migration_audit(migration_version);
