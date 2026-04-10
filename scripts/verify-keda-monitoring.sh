#!/bin/bash
# KEDA Autoscaler 성능 모니터링 검증 스크립트
# Design Ref: MTU-N239 §3.6
# Plan SC: FR-N239.8
set -euo pipefail

PASS=0
FAIL=0
WARN=0
TOTAL=0

check() {
  local description="$1"
  local result="$2"
  TOTAL=$((TOTAL+1))
  if [ "$result" = "PASS" ]; then
    echo "  [PASS] $description"
    PASS=$((PASS+1))
  elif [ "$result" = "WARN" ]; then
    echo "  [WARN] $description"
    WARN=$((WARN+1))
  else
    echo "  [FAIL] $description"
    FAIL=$((FAIL+1))
  fi
}

echo "=============================================="
echo " KEDA Autoscaler 모니터링 검증 (MTU-N239)"
echo " 실행 시각: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="
echo ""

# ── 1. Recording Rules ──
echo "[1/4] KEDA 성능 Recording Rules"
RULES="infra/monitoring/keda-performance-rules.yaml"
if [ -f "$RULES" ]; then
  check "파일 존재: $RULES" "PASS"
  if command -v python3 &>/dev/null; then
    if python3 -c "import yaml; yaml.safe_load(open('$RULES'))" 2>/dev/null; then
      check "YAML 구문 유효성" "PASS"
    else
      check "YAML 구문 유효성" "FAIL"
    fi
  else
    check "YAML 구문 유효성 (python3 없음)" "WARN"
  fi
  for rule in "keda:scaledobject:active" "keda:scaledobject:error_count" \
              "keda:scaling:events_per_minute" "keda:trigger:latency:p95" \
              "keda:trigger:error:ratio" "keda:operator:reconcile:rate5m" \
              "keda:operator:reconcile:duration:p95" "keda:cpu:usage_cores" \
              "keda:memory:usage_bytes" "keda:operator:pods_running"; do
    if grep -q "$rule" "$RULES"; then
      check "Recording rule: $rule" "PASS"
    else
      check "Recording rule: $rule" "FAIL"
    fi
  done
else
  check "파일 존재: $RULES" "FAIL"
fi
echo ""

# ── 2. 알림 규칙 ──
echo "[2/4] 알림 규칙"
ALERTS="infra/monitoring/keda-performance-alerts.yaml"
if [ -f "$ALERTS" ]; then
  check "파일 존재: $ALERTS" "PASS"
  if command -v python3 &>/dev/null; then
    if python3 -c "import yaml; yaml.safe_load(open('$ALERTS'))" 2>/dev/null; then
      check "YAML 구문 유효성" "PASS"
    else
      check "YAML 구문 유효성" "FAIL"
    fi
  else
    check "YAML 구문 유효성 (python3 없음)" "WARN"
  fi
  for alert in "KedaScaledObjectError" "KedaTriggerLatencyHigh" \
               "KedaOperatorReconcileSlow" "KedaScalingEventRateHigh" \
               "KedaOperatorDown"; do
    if grep -q "$alert" "$ALERTS"; then
      check "알림 규칙: $alert" "PASS"
    else
      check "알림 규칙: $alert" "FAIL"
    fi
  done
else
  check "파일 존재: $ALERTS" "FAIL"
fi
echo ""

# ── 3. 대시보드 ──
echo "[3/4] Grafana 대시보드"
DASHBOARD="infra/monitoring/dashboards/keda-autoscaler-performance.json"
if [ -f "$DASHBOARD" ]; then
  check "파일 존재: $DASHBOARD" "PASS"
  if command -v python3 &>/dev/null; then
    if python3 -c "import json; json.load(open('$DASHBOARD'))" 2>/dev/null; then
      check "JSON 구문 유효성" "PASS"
    else
      check "JSON 구문 유효성" "FAIL"
    fi
  else
    check "JSON 구문 유효성 (python3 없음)" "WARN"
  fi
  PANEL_COUNT=$(grep -c '"title"' "$DASHBOARD" || true)
  if [ "$PANEL_COUNT" -ge 8 ]; then
    check "대시보드 패널 수: ${PANEL_COUNT}개 (최소 8개)" "PASS"
  else
    check "대시보드 패널 수: ${PANEL_COUNT}개" "FAIL"
  fi
  for tag in "keda" "autoscaling"; do
    if grep -q "\"$tag\"" "$DASHBOARD"; then
      check "대시보드 태그: $tag" "PASS"
    else
      check "대시보드 태그: $tag" "FAIL"
    fi
  done
else
  check "파일 존재: $DASHBOARD" "FAIL"
fi
echo ""

# ── 4. 문서 완전성 ──
echo "[4/4] 문서 완전성"
for doc in "docs/01-plan/mtus/MTU-N239.plan.md" "docs/02-design/mtus/MTU-N239.design.md"; do
  if [ -f "$doc" ]; then
    check "문서 존재: $doc" "PASS"
  else
    check "문서 존재: $doc" "FAIL"
  fi
done
echo ""

echo "=============================================="
echo " 검증 결과 요약"
echo "=============================================="
echo "  전체: $TOTAL"
echo "  통과: $PASS"
echo "  경고: $WARN"
echo "  실패: $FAIL"
MATCH_RATE=0
if [ "$TOTAL" -gt 0 ]; then
  MATCH_RATE=$(( (PASS * 100) / TOTAL ))
fi
echo "  matchRate: ${MATCH_RATE}%"
echo "=============================================="
if [ "$FAIL" -gt 0 ]; then
  echo "  상태: 검증 실패 항목 있음"
  exit 1
else
  echo "  상태: 모든 검증 통과"
  exit 0
fi
