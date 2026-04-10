-- 마이그레이션 후 무결성 검증
-- Design Ref: §2.5 | Plan SC: FR-N150.7
-- CSAP D-12: 시스템 개발 보안 — 데이터 무결성 검증

-- 1. 최신 마이그레이션 확인
SELECT version, description, applied_at, execution_time_ms
FROM schema_migrations
ORDER BY applied_at DESC LIMIT 1;

-- 2. 외래 키 무결성 검증 (고아 레코드 확인)
SELECT 'users_orphan' AS check_name, COUNT(*) AS orphan_count
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
WHERE t.id IS NULL

UNION ALL

SELECT 'audit_logs_user_orphan', COUNT(*)
FROM audit_logs al
LEFT JOIN users u ON al.actor_id = u.id
WHERE al.actor_id IS NOT NULL AND u.id IS NULL;

-- 3. 인덱스 유효성 (invalid 인덱스 확인)
SELECT indexrelid::regclass AS index_name, indisvalid
FROM pg_index
WHERE NOT indisvalid;

-- 4. 시퀀스 일관성 (SERIAL 컬럼)
SELECT
    sequencename,
    last_value
FROM pg_sequences
WHERE schemaname = 'public';

-- 5. 테이블 통계 업데이트
ANALYZE;

-- 6. 마이그레이션 감사 기록
INSERT INTO migration_audit (migration_version, action, status, executed_by, environment, execution_time_ms)
VALUES ('post-check', 'VERIFY', 'SUCCESS', current_user, current_database(), 0);
