#!/usr/bin/env bash
# 백업 자동 검증 파이프라인 E2E 테스트
# Plan SC: FR-N151.1~FR-N151.6
set -euo pipefail

PROJECT_ROOT="/data/ai-saas"
BV_DIR="$PROJECT_ROOT/infra/backup-verification"
PASS=0; FAIL=0; TOTAL=0

pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "[FAIL] $1"; }

echo "=========================================="
echo "  MTU-N151 백업 자동 검증 E2E 테스트"
echo "=========================================="

# TC-N151.1: Velero 복구 검증 CronJob
echo ""
echo "--- TC-N151.1: Velero 복구 검증 ---"
[ -f "$BV_DIR/velero-verify-cronjob.yaml" ] && pass "TC-N151.1a: Velero CronJob 파일 존재" || fail "TC-N151.1a"
grep -q "kind: CronJob" "$BV_DIR/velero-verify-cronjob.yaml" && pass "TC-N151.1b: CronJob 리소스 정의" || fail "TC-N151.1b"
grep -q "backup-verify" "$BV_DIR/velero-verify-cronjob.yaml" && pass "TC-N151.1c: 격리 네임스페이스 로직" || fail "TC-N151.1c"
grep -q "velero restore create" "$BV_DIR/velero-verify-cronjob.yaml" && pass "TC-N151.1d: 복구 실행 로직" || fail "TC-N151.1d"
grep -q "kubectl delete namespace" "$BV_DIR/velero-verify-cronjob.yaml" && pass "TC-N151.1e: 자동 정리 로직" || fail "TC-N151.1e"

# TC-N151.2: CNPG 복구 검증
echo ""
echo "--- TC-N151.2: CNPG 복구 검증 ---"
[ -f "$BV_DIR/cnpg-verify-cronjob.yaml" ] && pass "TC-N151.2a: CNPG CronJob 파일 존재" || fail "TC-N151.2a"
grep -q "md5" "$BV_DIR/cnpg-verify-cronjob.yaml" && pass "TC-N151.2b: 체크섬 기반 무결성 검증" || fail "TC-N151.2b"
grep -q "verify-restore" "$BV_DIR/cnpg-verify-cronjob.yaml" && pass "TC-N151.2c: 복구 클러스터 생성" || fail "TC-N151.2c"
grep -q "kubectl wait" "$BV_DIR/cnpg-verify-cronjob.yaml" && pass "TC-N151.2d: 복구 대기 로직" || fail "TC-N151.2d"

# TC-N151.3: 보고서 자동 생성
echo ""
echo "--- TC-N151.3: 보고서 템플릿 ---"
[ -f "$BV_DIR/report-configmap.yaml" ] && pass "TC-N151.3a: 보고서 템플릿 존재" || fail "TC-N151.3a"
grep -q "RTO" "$BV_DIR/report-configmap.yaml" && pass "TC-N151.3b: RTO 측정 포함" || fail "TC-N151.3b"
grep -q "RPO" "$BV_DIR/report-configmap.yaml" && pass "TC-N151.3c: RPO 측정 포함" || fail "TC-N151.3c"
grep -q "D-07" "$BV_DIR/report-configmap.yaml" && pass "TC-N151.3d: CSAP D-07 증적 포함" || fail "TC-N151.3d"

# TC-N151.4: 암호화 검증
echo ""
echo "--- TC-N151.4: 백업 암호화 검증 ---"
grep -q "encryption" "$BV_DIR/cnpg-verify-cronjob.yaml" && pass "TC-N151.4a: 암호화 검증 로직 존재" || fail "TC-N151.4a"
grep -q "BackupEncryptionMissing" "$BV_DIR/alerts.yaml" && pass "TC-N151.4b: 암호화 미적용 알림 존재" || fail "TC-N151.4b"

# TC-N151.5: 알림 연동
echo ""
echo "--- TC-N151.5: 알림 설정 ---"
[ -f "$BV_DIR/alerts.yaml" ] && pass "TC-N151.5a: 알림 규칙 파일 존재" || fail "TC-N151.5a"
grep -q "BackupVerifyFailed\|VeleroBackupVerifyFailed" "$BV_DIR/alerts.yaml" && pass "TC-N151.5b: 복구 실패 알림" || fail "TC-N151.5b"
grep -q "BackupVerifyRTOExceeded" "$BV_DIR/alerts.yaml" && pass "TC-N151.5c: RTO 초과 알림" || fail "TC-N151.5c"
grep -q "BackupVerifyMissed" "$BV_DIR/alerts.yaml" && pass "TC-N151.5d: 검증 미실행 알림" || fail "TC-N151.5d"

# TC-N151.6: 감사 로그
echo ""
echo "--- TC-N151.6: 감사 로그 ---"
grep -q "audit.log" "$BV_DIR/velero-verify-cronjob.yaml" && pass "TC-N151.6a: Velero 감사 로그 기록" || fail "TC-N151.6a"
grep -q "audit.log" "$BV_DIR/cnpg-verify-cronjob.yaml" && pass "TC-N151.6b: CNPG 감사 로그 기록" || fail "TC-N151.6b"

# CSAP/N2SF 보안 검증
echo ""
echo "--- CSAP/N2SF 보안 ---"
grep -q "runAsNonRoot: true" "$BV_DIR/velero-verify-cronjob.yaml" && pass "TC-CSAP.1: 비root 실행" || fail "TC-CSAP.1"
grep -q "readOnlyRootFilesystem" "$BV_DIR/velero-verify-cronjob.yaml" && pass "TC-CSAP.2: 읽기전용 루트FS" || fail "TC-CSAP.2"
[ -f "$BV_DIR/rbac.yaml" ] && pass "TC-CSAP.3: RBAC 설정 존재" || fail "TC-CSAP.3"
grep -q "D-07" "$BV_DIR/alerts.yaml" && pass "TC-CSAP.4: D-07 도메인 레이블" || fail "TC-CSAP.4"
[ -f "$BV_DIR/kustomization.yaml" ] && pass "TC-CSAP.5: Kustomization 존재" || fail "TC-CSAP.5"

echo ""
echo "=========================================="
echo "  테스트 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "=========================================="
[ "$FAIL" -eq 0 ] && echo "[SUCCESS] 모든 테스트 통과" && exit 0 || { echo "[FAILURE] $FAIL 건 실패"; exit 1; }
