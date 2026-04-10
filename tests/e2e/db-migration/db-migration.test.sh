#!/usr/bin/env bash
# DB 마이그레이션 자동화 E2E 테스트
# Design Ref: §2 전체 | Plan SC: FR-N150.1~FR-N150.7
set -euo pipefail

PROJECT_ROOT="/data/ai-saas"
MIG_DIR="$PROJECT_ROOT/infra/db-migration"
PASS=0; FAIL=0; TOTAL=0

pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "[FAIL] $1"; }

echo "=========================================="
echo "  MTU-N150 DB 마이그레이션 E2E 테스트"
echo "=========================================="

# TC-N150.1: Atlas 설정 검증
echo ""
echo "--- TC-N150.1: Atlas 스키마 관리 설정 ---"
[ -f "$MIG_DIR/atlas.hcl" ] && pass "TC-N150.1a: atlas.hcl 존재" || fail "TC-N150.1a: atlas.hcl 미존재"
grep -q 'env "dev"' "$MIG_DIR/atlas.hcl" && pass "TC-N150.1b: dev 환경 설정" || fail "TC-N150.1b: dev 환경 미설정"
grep -q 'env "stg"' "$MIG_DIR/atlas.hcl" && pass "TC-N150.1c: stg 환경 설정" || fail "TC-N150.1c: stg 환경 미설정"
grep -q 'env "prod"' "$MIG_DIR/atlas.hcl" && pass "TC-N150.1d: prod 환경 설정" || fail "TC-N150.1d: prod 환경 미설정"
grep -q 'destructive' "$MIG_DIR/atlas.hcl" && pass "TC-N150.1e: 파괴적 변경 lint 설정" || fail "TC-N150.1e: lint 미설정"

# TC-N150.2: 마이그레이션 파일 구조
echo ""
echo "--- TC-N150.2: 마이그레이션 파일 구조 ---"
[ -f "$MIG_DIR/schema.sql" ] && pass "TC-N150.2a: schema.sql 존재" || fail "TC-N150.2a: schema.sql 미존재"
[ -d "$MIG_DIR/migrations" ] && pass "TC-N150.2b: migrations/ 디렉토리 존재" || fail "TC-N150.2b: migrations/ 미존재"
[ -d "$MIG_DIR/rollback" ] && pass "TC-N150.2c: rollback/ 디렉토리 존재" || fail "TC-N150.2c: rollback/ 미존재"
[ -d "$MIG_DIR/verification" ] && pass "TC-N150.2d: verification/ 디렉토리 존재" || fail "TC-N150.2d: verification/ 미존재"

MIG_COUNT=$(ls "$MIG_DIR/migrations/"*.sql 2>/dev/null | wc -l)
[ "$MIG_COUNT" -ge 2 ] && pass "TC-N150.2e: 마이그레이션 파일 $MIG_COUNT개 존재" || fail "TC-N150.2e: 마이그레이션 파일 부족"

# TC-N150.3: CI 파이프라인
echo ""
echo "--- TC-N150.3: CI 파이프라인 ---"
[ -f "$MIG_DIR/ci/migration-ci.yaml" ] && pass "TC-N150.3a: CI 파이프라인 파일 존재" || fail "TC-N150.3a: CI 파일 미존재"
grep -q "lint" "$MIG_DIR/ci/migration-ci.yaml" && pass "TC-N150.3b: lint 단계 정의" || fail "TC-N150.3b: lint 미정의"
grep -q "dry-run" "$MIG_DIR/ci/migration-ci.yaml" && pass "TC-N150.3c: dry-run 단계 정의" || fail "TC-N150.3c: dry-run 미정의"
grep -q "apply" "$MIG_DIR/ci/migration-ci.yaml" && pass "TC-N150.3d: apply 단계 정의" || fail "TC-N150.3d: apply 미정의"

# TC-N150.4: 롤백 전략
echo ""
echo "--- TC-N150.4: 롤백 전략 ---"
ROLLBACK_COUNT=$(ls "$MIG_DIR/rollback/"*.down.sql 2>/dev/null | wc -l)
[ "$ROLLBACK_COUNT" -ge 2 ] && pass "TC-N150.4a: 롤백 스크립트 $ROLLBACK_COUNT개 존재" || fail "TC-N150.4a: 롤백 스크립트 부족"

# 각 마이그레이션에 대응하는 롤백 존재 확인
for f in "$MIG_DIR/migrations/"*.sql; do
  base=$(basename "$f" .sql)
  if [ -f "$MIG_DIR/rollback/${base}.down.sql" ]; then
    pass "TC-N150.4b: $base 롤백 대응"
  else
    fail "TC-N150.4b: $base 롤백 미대응"
  fi
done

# TC-N150.5: 환경별 분리
echo ""
echo "--- TC-N150.5: 환경별 분리 ---"
grep -q "sslmode=disable" "$MIG_DIR/atlas.hcl" && pass "TC-N150.5a: dev SSL 비활성화 (로컬)" || fail "TC-N150.5a: dev 설정 이상"
grep -q "sslmode=require" "$MIG_DIR/atlas.hcl" && pass "TC-N150.5b: prod SSL 필수 (CSAP D-09)" || fail "TC-N150.5b: prod SSL 미설정"

# TC-N150.6: 감사 로그
echo ""
echo "--- TC-N150.6: 감사 로그 설정 ---"
grep -q "audit.jsonl" "$MIG_DIR/ci/migration-ci.yaml" && pass "TC-N150.6a: CI audit.jsonl 기록" || fail "TC-N150.6a: audit 미기록"
grep -q "migration_audit" "$MIG_DIR/migrations/20260410000002_add_audit_table.sql" && pass "TC-N150.6b: migration_audit 테이블 정의" || fail "TC-N150.6b: migration_audit 미정의"

# TC-N150.7: 무결성 검증
echo ""
echo "--- TC-N150.7: 데이터 무결성 검증 ---"
[ -f "$MIG_DIR/verification/pre-check.sql" ] && pass "TC-N150.7a: pre-check.sql 존재" || fail "TC-N150.7a: pre-check 미존재"
[ -f "$MIG_DIR/verification/post-check.sql" ] && pass "TC-N150.7b: post-check.sql 존재" || fail "TC-N150.7b: post-check 미존재"
grep -q "FOREIGN KEY" "$MIG_DIR/verification/pre-check.sql" && pass "TC-N150.7c: FK 무결성 검증 포함" || fail "TC-N150.7c: FK 검증 미포함"

# CSAP/N2SF 보안 검증
echo ""
echo "--- CSAP/N2SF 보안 검증 ---"
[ -f "$MIG_DIR/k8s-migration-job.yaml" ] && pass "TC-CSAP.1: K8s Migration Job 존재" || fail "TC-CSAP.1: Job 미존재"
grep -q "runAsNonRoot: true" "$MIG_DIR/k8s-migration-job.yaml" && pass "TC-CSAP.2: 비root 실행 (D-11)" || fail "TC-CSAP.2: 비root 미설정"
grep -q "readOnlyRootFilesystem: true" "$MIG_DIR/k8s-migration-job.yaml" && pass "TC-CSAP.3: 읽기전용 루트FS (D-11)" || fail "TC-CSAP.3: 읽기전용 미설정"
grep -q "pre-backup" "$MIG_DIR/k8s-migration-job.yaml" && pass "TC-CSAP.4: 마이그레이션 전 백업 (D-07)" || fail "TC-CSAP.4: 백업 미설정"
grep -q "PII" "$MIG_DIR/ci/migration-ci.yaml" && pass "TC-N2SF.1: PII 데이터 검사 (N-05)" || fail "TC-N2SF.1: PII 검사 미포함"

echo ""
echo "=========================================="
echo "  테스트 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "=========================================="
[ "$FAIL" -eq 0 ] && echo "[SUCCESS] 모든 테스트 통과" && exit 0 || { echo "[FAILURE] $FAIL 건 실패"; exit 1; }
