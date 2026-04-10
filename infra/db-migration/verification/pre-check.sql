-- 마이그레이션 전 무결성 검증
-- Design Ref: §2.5 | Plan SC: FR-N150.7
-- CSAP D-12: 시스템 개발 보안 — 데이터 무결성 검증

-- 1. 현재 스키마 버전 확인
SELECT version, applied_at FROM schema_migrations ORDER BY applied_at DESC LIMIT 5;

-- 2. 테이블 존재 확인
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- 3. 외래 키 제약 조건 무결성
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 4. 인덱스 상태 확인
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 5. 디스크 사용량 (대용량 테이블 마이그레이션 시간 예측)
SELECT
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
    n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
