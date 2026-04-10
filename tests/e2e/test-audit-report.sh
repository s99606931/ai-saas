#!/usr/bin/env bash
# Plan SC: FR-N85.1 ~ FR-N85.6
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0; RESULTS=""
pass_test() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); RESULTS="${RESULTS}\n  [PASS] $1"; }
fail_test() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); RESULTS="${RESULTS}\n  [FAIL] $1: $2"; }

echo "============================================"
echo " MTU-N85: 감사 보고서 자동 생성 E2E"
echo "============================================"

# T01: CronJob
echo "[T01] CronJob 검증..."
F="/data/ai-saas/infra/compliance/report-generator/cronjob.yaml"
if [ -f "$F" ] && grep -q "CronJob" "$F" && grep -q "compliance-report" "$F" && grep -q "ClusterRole" "$F"; then
  pass_test "T01: CronJob + RBAC"
else fail_test "T01: CronJob" "설정 누락"; fi

# T02: 드리프트 탐지
echo "[T02] 드리프트 탐지 설정 검증..."
F="/data/ai-saas/infra/compliance/report-generator/drift-detection.yaml"
if [ -f "$F" ]; then
  C=0
  grep -q "rbac:" "$F" && C=$((C+1))
  grep -q "network:" "$F" && C=$((C+1))
  grep -q "policies:" "$F" && C=$((C+1))
  grep -q "certificates:" "$F" && C=$((C+1))
  grep -q "pss_labels:" "$F" && C=$((C+1))
  grep -q "security_tools:" "$F" && C=$((C+1))
  [ "$C" -ge 5 ] && pass_test "T02: 드리프트 탐지 (${C}/6 모니터)" || fail_test "T02: 드리프트" "${C}/6"
else fail_test "T02: 드리프트" "파일 없음"; fi

# T03: 감리 체크리스트
echo "[T03] 감리 체크리스트 스크립트 검증..."
F="/data/ai-saas/scripts/audit-checklist-verify.sh"
if [ -f "$F" ] && grep -q "행안부" "$F" && grep -q "감리" "$F"; then
  pass_test "T03: 감리 체크리스트 스크립트"
else fail_test "T03: 감리 체크리스트" "스크립트 없음"; fi

# T04: 감리 체크리스트 실행
echo "[T04] 감리 체크리스트 실행..."
chmod +x /data/ai-saas/scripts/audit-checklist-verify.sh
if bash /data/ai-saas/scripts/audit-checklist-verify.sh 2>/dev/null | grep -q "준수율:"; then
  pass_test "T04: 감리 체크리스트 실행 성공"
else fail_test "T04: 감리 체크리스트" "실행 실패"; fi

# T05: 알림 규칙
echo "[T05] 알림 규칙 검증..."
F="/data/ai-saas/infra/compliance/report-generator/alerting-rules.yaml"
if [ -f "$F" ] && grep -q "PrometheusRule" "$F" && grep -q "ComplianceRateDropped" "$F" && grep -q "DriftDetected" "$F"; then
  pass_test "T05: 알림 규칙 (준수율 + 드리프트)"
else fail_test "T05: 알림 규칙" "설정 누락"; fi

# T06: YAML 문법
echo "[T06] YAML 문법 검증..."
OK=0; TOT=0
for f in /data/ai-saas/infra/compliance/report-generator/*.yaml; do
  TOT=$((TOT+1))
  python3 -c "import yaml; list(yaml.safe_load_all(open('$f')))" 2>/dev/null && OK=$((OK+1))
done
[ "$OK" -eq "$TOT" ] && pass_test "T06: YAML 문법 (${OK}/${TOT})" || fail_test "T06: YAML" "${OK}/${TOT}"

echo ""
echo "============================================"
echo " MTU-N85 E2E 테스트 결과"
echo "============================================"
echo -e "$RESULTS"
echo " 통과: ${PASS}/${TOTAL} | 실패: ${FAIL}/${TOTAL}"
[ "$FAIL" -gt 0 ] && { echo " [WARNING] 실패"; exit 1; } || { echo " [SUCCESS] 모든 테스트 통과"; exit 0; }
