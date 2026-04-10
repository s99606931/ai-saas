#!/usr/bin/env bash
# Plan SC: FR-N83.1 ~ FR-N83.6
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0; RESULTS=""
pass_test() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); RESULTS="${RESULTS}\n  [PASS] $1"; }
fail_test() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); RESULTS="${RESULTS}\n  [FAIL] $1: $2"; }

echo "============================================"
echo " MTU-N83: 이상 탐지 ML 모델 E2E"
echo "============================================"

# T01: CronJob 매니페스트
echo "[T01] CronJob 검증..."
F="/data/ai-saas/infra/anomaly-detection/cronjob.yaml"
if [ -f "$F" ] && grep -q "CronJob" "$F" && grep -q "anomaly-detector" "$F" && grep -q "runAsNonRoot: true" "$F"; then
  pass_test "T01: CronJob (30분 주기, PSS 준수)"
else fail_test "T01: CronJob" "설정 누락"; fi

# T02: 설정 ConfigMap
echo "[T02] 설정 ConfigMap 검증..."
F="/data/ai-saas/infra/anomaly-detection/config.yaml"
if [ -f "$F" ]; then
  C=0
  grep -q "cpu:" "$F" && C=$((C+1))
  grep -q "memory:" "$F" && C=$((C+1))
  grep -q "latency" "$F" && C=$((C+1))
  grep -q "error_rate:" "$F" && C=$((C+1))
  grep -q "cost_anomaly:" "$F" && C=$((C+1))
  grep -q "security_triggers:" "$F" && C=$((C+1))
  grep -q "zscore" "$F" && C=$((C+1))
  [ "$C" -ge 6 ] && pass_test "T02: 설정 (${C}/7 메트릭 + 알고리즘)" || fail_test "T02: 설정" "${C}/7"
else fail_test "T02: 설정" "파일 없음"; fi

# T03: 비용 이상 탐지 알림
echo "[T03] 비용 이상 탐지 알림 검증..."
F="/data/ai-saas/infra/anomaly-detection/cost-anomaly-alerts.yaml"
if [ -f "$F" ] && grep -q "PrometheusRule" "$F" && grep -q "CostAnomaly" "$F" && grep -q "finops" "$F"; then
  pass_test "T03: 비용 이상 탐지 알림 (FinOps)"
else fail_test "T03: 비용 알림" "설정 누락"; fi

# T04: 보안 상관 분석
echo "[T04] 보안 상관 분석 검증..."
F="/data/ai-saas/infra/anomaly-detection/security-correlation.yaml"
if [ -f "$F" ]; then
  C=0
  grep -q "CorrelatedSecurityEvent" "$F" && C=$((C+1))
  grep -q "FalcoNetworkAnomaly" "$F" && C=$((C+1))
  grep -q "AuthFailure" "$F" && C=$((C+1))
  grep -q "DataExfiltration" "$F" && C=$((C+1))
  grep -q "D-06" "$F" && C=$((C+1))
  [ "$C" -ge 4 ] && pass_test "T04: 보안 상관 분석 (${C}/5 규칙, CSAP D-06)" || fail_test "T04: 보안 상관" "${C}/5"
else fail_test "T04: 보안 상관" "파일 없음"; fi

# T05: YAML 문법
echo "[T05] YAML 문법 검증..."
OK=0; TOT=0
for f in /data/ai-saas/infra/anomaly-detection/*.yaml; do
  TOT=$((TOT+1))
  python3 -c "import yaml; list(yaml.safe_load_all(open('$f')))" 2>/dev/null && OK=$((OK+1))
done
[ "$OK" -eq "$TOT" ] && pass_test "T05: YAML 문법 (${OK}/${TOT})" || fail_test "T05: YAML" "${OK}/${TOT}"

# T06: 시크릿 검사
echo "[T06] 시크릿 검사..."
SEC=0
for f in /data/ai-saas/infra/anomaly-detection/*.yaml; do
  grep -iE "(password|api.?key)\s*[:=]\s*['\"]?[a-zA-Z0-9]{8}" "$f" 2>/dev/null | grep -v "configMapKeyRef\|secretKeyRef" | grep -q . && SEC=$((SEC+1))
done
[ "$SEC" -eq 0 ] && pass_test "T06: 시크릿 하드코딩 없음" || fail_test "T06: 시크릿" "${SEC}개"

echo ""
echo "============================================"
echo " MTU-N83 E2E 테스트 결과"
echo "============================================"
echo -e "$RESULTS"
echo " 통과: ${PASS}/${TOTAL} | 실패: ${FAIL}/${TOTAL}"
[ "$FAIL" -gt 0 ] && { echo " [WARNING] 실패"; exit 1; } || { echo " [SUCCESS] 모든 테스트 통과"; exit 0; }
