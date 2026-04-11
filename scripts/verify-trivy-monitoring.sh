#!/bin/bash
# Trivy Operator 취약점 스캔 모니터링 검증 스크립트
# Design Ref: MTU-N241
# Plan SC: FR-N241.8
set -euo pipefail

PASS=0
FAIL=0
TOTAL=0

check() {
  local description="$1"
  local result="$2"
  TOTAL=$((TOTAL+1))
  if [ "$result" = "PASS" ]; then
    echo "  [PASS] $description"
    PASS=$((PASS+1))
  else
    echo "  [FAIL] $description"
    FAIL=$((FAIL+1))
  fi
}

echo "=============================================="
echo " Trivy Operator 모니터링 검증 (MTU-N241)"
echo " 실행 시각: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="
echo ""

echo "[1/4] Recording Rules"
RULES="infra/monitoring/trivy-performance-rules.yaml"
if [ -f "$RULES" ]; then
  check "파일 존재" "PASS"
  if python3 -c "import yaml; yaml.safe_load(open('$RULES'))" 2>/dev/null; then
    check "YAML 유효성" "PASS"
  else
    check "YAML 유효성" "FAIL"
  fi
  for rule in "trivy:vulnerabilities:by_severity" "trivy:vulnerabilities:critical_total" \
              "trivy:vulnerabilities:high_total" "trivy:scan:duration:p50" \
              "trivy:scan:duration:p95" "trivy:scan:coverage_ratio" \
              "trivy:cpu:usage_cores" "trivy:memory:usage_bytes"; do
    if grep -q "$rule" "$RULES"; then
      check "규칙: $rule" "PASS"
    else
      check "규칙: $rule" "FAIL"
    fi
  done
else
  check "파일 존재" "FAIL"
fi
echo ""

echo "[2/4] 알림 규칙"
ALERTS="infra/monitoring/trivy-performance-alerts.yaml"
if [ -f "$ALERTS" ]; then
  check "파일 존재" "PASS"
  if python3 -c "import yaml; yaml.safe_load(open('$ALERTS'))" 2>/dev/null; then
    check "YAML 유효성" "PASS"
  else
    check "YAML 유효성" "FAIL"
  fi
  for alert in "TrivyCriticalVulnerabilityFound" "TrivyHighVulnerabilitiesIncreasing" \
               "TrivyScanDurationHigh" "TrivyScanCoverageLow" "TrivyOperatorDown"; do
    if grep -q "$alert" "$ALERTS"; then
      check "알림: $alert" "PASS"
    else
      check "알림: $alert" "FAIL"
    fi
  done
  if grep -q "csap_control" "$ALERTS"; then check "CSAP 참조" "PASS"; else check "CSAP 참조" "FAIL"; fi
else
  check "파일 존재" "FAIL"
fi
echo ""

echo "[3/4] 대시보드"
DASH="infra/monitoring/dashboards/trivy-vulnerability-scan.json"
if [ -f "$DASH" ]; then
  check "파일 존재" "PASS"
  if python3 -c "import json; json.load(open('$DASH'))" 2>/dev/null; then
    check "JSON 유효성" "PASS"
  else
    check "JSON 유효성" "FAIL"
  fi
  PANEL_COUNT=$(grep -c '"title"' "$DASH" || true)
  if [ "$PANEL_COUNT" -ge 7 ]; then check "패널 수: ${PANEL_COUNT}" "PASS"; else check "패널 수: ${PANEL_COUNT}" "FAIL"; fi
  for tag in "trivy" "vulnerability"; do
    if grep -q "\"$tag\"" "$DASH"; then check "태그: $tag" "PASS"; else check "태그: $tag" "FAIL"; fi
  done
else
  check "파일 존재" "FAIL"
fi
echo ""

echo "[4/4] 문서"
for doc in "docs/01-plan/mtus/MTU-N241.plan.md" "docs/02-design/mtus/MTU-N241.design.md"; do
  if [ -f "$doc" ]; then check "$(basename $doc)" "PASS"; else check "$(basename $doc)" "FAIL"; fi
done
echo ""

echo "=============================================="
echo " 결과: 전체=$TOTAL 통과=$PASS 실패=$FAIL"
MATCH_RATE=0
if [ "$TOTAL" -gt 0 ]; then MATCH_RATE=$(( (PASS * 100) / TOTAL )); fi
echo " matchRate: ${MATCH_RATE}%"
echo "=============================================="
if [ "$FAIL" -gt 0 ]; then exit 1; else echo " 모든 검증 통과"; exit 0; fi
