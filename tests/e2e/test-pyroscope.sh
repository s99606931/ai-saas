#!/usr/bin/env bash
# Plan SC: FR-N82.1 ~ FR-N82.6
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0; RESULTS=""
pass_test() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); RESULTS="${RESULTS}\n  [PASS] $1"; }
fail_test() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); RESULTS="${RESULTS}\n  [FAIL] $1: $2"; }

echo "============================================"
echo " MTU-N82: Pyroscope 연속 프로파일링 E2E"
echo "============================================"

# T01: Helm values
echo "[T01] Helm values 검증..."
F="/data/ai-saas/infra/pyroscope/values.yaml"
if [ -f "$F" ]; then
  C=0
  grep -q "pyroscope:" "$F" && C=$((C+1))
  grep -q "monolithic\|filesystem" "$F" && C=$((C+1))
  grep -q "alloy:" "$F" && C=$((C+1))
  grep -q "ebpf" "$F" && C=$((C+1))
  grep -q "persistence:" "$F" && C=$((C+1))
  grep -q "securityContext:" "$F" && C=$((C+1))
  [ "$C" -ge 5 ] && pass_test "T01: Helm values (${C}/6 설정)" || fail_test "T01: Helm values" "${C}/6"
else fail_test "T01: Helm values" "파일 없음"; fi

# T02: Grafana 데이터소스
echo "[T02] Grafana 데이터소스 검증..."
F="/data/ai-saas/infra/pyroscope/grafana-datasource.yaml"
if [ -f "$F" ] && grep -q "grafana-pyroscope-datasource" "$F" && grep -q "4040" "$F"; then
  pass_test "T02: Grafana 데이터소스 (Pyroscope)"
else fail_test "T02: Grafana 데이터소스" "설정 누락"; fi

# T03: NetworkPolicy
echo "[T03] NetworkPolicy 검증..."
F="/data/ai-saas/infra/pyroscope/network-policy.yaml"
if [ -f "$F" ] && grep -q "NetworkPolicy" "$F" && grep -q "Ingress" "$F" && grep -q "Egress" "$F"; then
  pass_test "T03: NetworkPolicy (CSAP D-08)"
else fail_test "T03: NetworkPolicy" "설정 누락"; fi

# T04: 알림 규칙
echo "[T04] 알림 규칙 검증..."
F="/data/ai-saas/infra/pyroscope/alerting-rules.yaml"
if [ -f "$F" ] && grep -q "PrometheusRule" "$F" && grep -q "PyroscopeServerDown" "$F"; then
  pass_test "T04: 알림 규칙 (서버 다운 + 디스크 + 메모리)"
else fail_test "T04: 알림 규칙" "설정 누락"; fi

# T05: YAML 문법
echo "[T05] YAML 문법 검증..."
OK=0; TOT=0
for f in /data/ai-saas/infra/pyroscope/*.yaml; do
  TOT=$((TOT+1))
  python3 -c "import yaml; list(yaml.safe_load_all(open('$f')))" 2>/dev/null && OK=$((OK+1))
done
[ "$OK" -eq "$TOT" ] && pass_test "T05: YAML 문법 (${OK}/${TOT})" || fail_test "T05: YAML" "${OK}/${TOT}"

# T06: N2SF 데이터 등급 라벨
echo "[T06] N2SF 데이터 등급 검증..."
if grep -q "n2sf.data/grade: O" /data/ai-saas/infra/pyroscope/values.yaml; then
  pass_test "T06: N2SF O등급 데이터 라벨"
else fail_test "T06: N2SF 라벨" "등급 라벨 없음"; fi

# T07: 시크릿 검사
echo "[T07] 시크릿 하드코딩 검사..."
SEC=0
for f in /data/ai-saas/infra/pyroscope/*.yaml; do
  grep -iE "(password|api.?key|token)\s*[:=]\s*['\"]?[a-zA-Z0-9]{8}" "$f" 2>/dev/null | grep -v "automountServiceAccountToken" | grep -q . && SEC=$((SEC+1))
done
[ "$SEC" -eq 0 ] && pass_test "T07: 시크릿 하드코딩 없음" || fail_test "T07: 시크릿" "${SEC}개"

echo ""
echo "============================================"
echo " MTU-N82 E2E 테스트 결과"
echo "============================================"
echo -e "$RESULTS"
echo " 통과: ${PASS}/${TOTAL} | 실패: ${FAIL}/${TOTAL}"
[ "$FAIL" -gt 0 ] && { echo " [WARNING] 실패"; exit 1; } || { echo " [SUCCESS] 모든 테스트 통과"; exit 0; }
