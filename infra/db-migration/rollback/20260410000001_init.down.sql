-- 롤백: 초기 스키마
-- Design Ref: §2.4 | Plan SC: FR-N150.4
DROP TABLE IF EXISTS schema_migrations;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS tenants;
DROP SCHEMA IF EXISTS atlas_schema_revisions;
