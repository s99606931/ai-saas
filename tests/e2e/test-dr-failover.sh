#!/usr/bin/env bash
# Plan SC: FR-N87.1 ~ FR-N87.6
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0; RESULTS=""
pass_test() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); RESULTS="${RESULTS}\n  [PASS] $1"; }
fail_test() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); RESULTS="${RESULTS}\n  [FAIL] $1: $2"; }

echo "============================================"
echo " MTU-N87: 재해복구 자동 페일오버 E2E"
echo "============================================"

# T01: DR 아키텍처 설정
echo "[T01] DR 아키텍처 설정 검증..."
F="/data/ai-saas/infra/dr/architecture.yaml"
if [ -f "$F" ] && grep -q "active-passive" "$F" && grep -q "rto:" "$F" && grep -q "rpo:" "$F" && grep -q "failover:" "$F"; then
  pass_test "T01: DR 아키텍처 (Active-Passive, RTO/RPO 정의)"
else fail_test "T01: DR 아키텍처" "설정 누락"; fi

# T02: 페일오버 컨트롤러
echo "[T02] 페일오버 컨트롤러 검증..."
F="/data/ai-saas/infra/dr/failover-controller.yaml"
if [ -f "$F" ] && grep -q "CronJob" "$F" && grep -q "health-monitor" "$F" && grep -q "ClusterRole" "$F"; then
  pass_test "T02: 페일오버 컨트롤러 (CronJob + RBAC)"
else fail_test "T02: 페일오버 컨트롤러" "설정 누락"; fi

# T03: DR 테스트 자동화
echo "[T03] DR 테스트 자동화 검증..."
F="/data/ai-saas/infra/dr/dr-test-cronjob.yaml"
if [ -f "$F" ] && grep -q "CronJob" "$F" && grep -q "dr-test" "$F"; then
  pass_test "T03: DR 테스트 자동화 (주간 CronJob)"
else fail_test "T03: DR 테스트" "설정 누락"; fi

# T04: 알림 규칙
echo "[T04] 알림 규칙 검증..."
F="/data/ai-saas/infra/dr/alerting-rules.yaml"
if [ -f "$F" ]; then
  C=0
  grep -q "DRPrimaryClusterUnhealthy" "$F" && C=$((C+1))
  grep -q "DRFailoverTriggered" "$F" && C=$((C+1))
  grep -q "DRBackupDelayed" "$F" && C=$((C+1))
  grep -q "DRTestFailed" "$F" && C=$((C+1))
  grep -q "DRDatabaseReplicationLag" "$F" && C=$((C+1))
  [ "$C" -ge 4 ] && pass_test "T04: 알림 규칙 (${C}/5 유형)" || fail_test "T04: 알림 규칙" "${C}/5"
else fail_test "T04: 알림 규칙" "파일 없음"; fi

# T05: YAML 문법
echo "[T05] YAML 문법 검증..."
OK=0; TOT=0
for f in /data/ai-saas/infra/dr/*.yaml; do
  TOT=$((TOT+1))
  python3 -c "import yaml; list(yaml.safe_load_all(open('$f')))" 2>/dev/null && OK=$((OK+1))
done
[ "$OK" -eq "$TOT" ] && pass_test "T05: YAML 문법 (${OK}/${TOT})" || fail_test "T05: YAML" "${OK}/${TOT}"

# T06: CSAP D-13 라벨
echo "[T06] CSAP D-13 라벨 검증..."
C=0
for f in /data/ai-saas/infra/dr/*.yaml; do
  grep -q "D-13" "$f" && C=$((C+1))
done
[ "$C" -ge 3 ] && pass_test "T06: CSAP D-13 라벨 (${C}개 파일)" || fail_test "T06: CSAP 라벨" "${C}개만"

# T07: 시크릿 검사
echo "[T07] 시크릿 하드코딩 검사..."
SEC=0
for f in /data/ai-saas/infra/dr/*.yaml; do
  grep -iE "(password|api.?key)\s*[:=]\s*['\"]?[a-zA-Z0-9]{8}" "$f" 2>/dev/null | grep -v "secretKeyRef\|configMapKeyRef\|automountServiceAccountToken" | grep -q . && SEC=$((SEC+1))
done
[ "$SEC" -eq 0 ] && pass_test "T07: 시크릿 하드코딩 없음" || fail_test "T07: 시크릿" "${SEC}개"

echo ""
echo "============================================"
echo " MTU-N87 E2E 테스트 결과"
echo "============================================"
echo -e "$RESULTS"
echo " 통과: ${PASS}/${TOTAL} | 실패: ${FAIL}/${TOTAL}"
[ "$FAIL" -gt 0 ] && { echo " [WARNING] 실패"; exit 1; } || { echo " [SUCCESS] 모든 테스트 통과"; exit 0; }
