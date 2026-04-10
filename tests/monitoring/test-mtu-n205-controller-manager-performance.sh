#!/bin/bash
# MTU-N205: Controller Manager 성능 모니터링 E2E 테스트
# Design Ref: docs/02-design/mtus/MTU-N205-controller-manager-performance.design.md
# Plan SC: FR-N205.7
# CSAP: D-12 시스템 개발 보안

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="${SCRIPT_DIR}/../../infra/monitoring"
PASS=0
FAIL=0
TOTAL=0

pass() { PASS=$((PASS + 1)); TOTAL=$((TOTAL + 1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL + 1)); TOTAL=$((TOTAL + 1)); echo "[FAIL] $1"; }

echo "=============================================="
echo "MTU-N205: Controller Manager 성능 모니터링 E2E 테스트"
echo "=============================================="

# --- E2E #1: 워크큐 깊이 recording rules ---
echo ""
echo "--- E2E #1: FR-N205.1 워크큐 깊이 recording rules ---"
RULES_FILE="${INFRA_DIR}/controller-manager/controller-manager-performance-rules.yaml"
if [ -f "$RULES_FILE" ]; then
  for metric in "controller_mgr_perf:workqueue_depth_by_name" "controller_mgr_perf:workqueue_depth_total"; do
    if grep -q "$metric" "$RULES_FILE"; then
      pass "$metric recording rule 존재"
    else
      fail "$metric recording rule 누락"
    fi
  done
else
  fail "Recording rules 파일 미존재: $RULES_FILE"
fi

# --- E2E #2: 처리 레이턴시 recording rules ---
echo ""
echo "--- E2E #2: FR-N205.2 처리 레이턴시 recording rules ---"
for metric in "controller_mgr_perf:work_duration_p50" "controller_mgr_perf:work_duration_p90" "controller_mgr_perf:work_duration_p99" "controller_mgr_perf:queue_duration_p99"; do
  if grep -q "$metric" "$RULES_FILE"; then
    pass "$metric recording rule 존재"
  else
    fail "$metric recording rule 누락"
  fi
done

# --- E2E #3: 재시도/추가 비율 recording rules ---
echo ""
echo "--- E2E #3: FR-N205.3 재시도/추가 비율 recording rules ---"
for metric in "controller_mgr_perf:retries_rate" "controller_mgr_perf:adds_rate" "controller_mgr_perf:longest_running_processor"; do
  if grep -q "$metric" "$RULES_FILE"; then
    pass "$metric recording rule 존재"
  else
    fail "$metric recording rule 누락"
  fi
done

# --- E2E #4: 워크큐 깊이 알림 ---
echo ""
echo "--- E2E #4: FR-N205.4 워크큐 깊이 알림 ---"
ALERTS_FILE="${INFRA_DIR}/controller-manager/controller-manager-performance-alerts.yaml"
if [ -f "$ALERTS_FILE" ]; then
  for alert in "ControllerManagerQueueDepthHigh" "ControllerManagerQueueDepthCritical"; do
    if grep -q "$alert" "$ALERTS_FILE"; then
      pass "$alert 알림 규칙 존재"
    else
      fail "$alert 알림 규칙 누락"
    fi
  done
else
  fail "Alerting rules 파일 미존재: $ALERTS_FILE"
fi

# --- E2E #5: 처리 레이턴시/재시도 알림 ---
echo ""
echo "--- E2E #5: FR-N205.5 처리 레이턴시/재시도 알림 ---"
for alert in "ControllerManagerWorkDurationHigh" "ControllerManagerRetriesHigh"; do
  if grep -q "$alert" "$ALERTS_FILE"; then
    pass "$alert 알림 규칙 존재"
  else
    fail "$alert 알림 규칙 누락"
  fi
done

# --- E2E #6: Grafana 대시보드 ---
echo ""
echo "--- E2E #6: FR-N205.6 Grafana 대시보드 ---"
DASHBOARD_FILE="${INFRA_DIR}/dashboards/controller-manager-performance-dashboard.json"
if [ -f "$DASHBOARD_FILE" ]; then
  pass "대시보드 파일 존재"
  if grep -q "controller_mgr_perf:workqueue_depth" "$DASHBOARD_FILE"; then
    pass "워크큐 깊이 패널 포함"
  else
    fail "워크큐 깊이 패널 누락"
  fi
  if grep -q "controller_mgr_perf:work_duration" "$DASHBOARD_FILE"; then
    pass "처리 레이턴시 패널 포함"
  else
    fail "처리 레이턴시 패널 누락"
  fi
  if grep -q "controller_mgr_perf:retries_rate" "$DASHBOARD_FILE"; then
    pass "재시도율 패널 포함"
  else
    fail "재시도율 패널 누락"
  fi
else
  fail "대시보드 파일 미존재: $DASHBOARD_FILE"
fi

# --- 유효성 검사 ---
echo ""
echo "--- 유효성 검사 ---"
for file in "$RULES_FILE" "$ALERTS_FILE"; do
  if python3 -c "import yaml; yaml.safe_load(open('$file'))" 2>/dev/null; then
    pass "$(basename $file) YAML 유효"
  else
    fail "$(basename $file) YAML 무효"
  fi
done
if python3 -c "import json; json.load(open('$DASHBOARD_FILE'))" 2>/dev/null; then
  pass "대시보드 JSON 유효"
else
  fail "대시보드 JSON 무효"
fi

# --- CSAP 참조 ---
echo ""
echo "--- CSAP 참조 검사 ---"
if grep -q "csap.*D-10" "$ALERTS_FILE"; then
  pass "CSAP D-10 참조 존재"
else
  fail "CSAP D-10 참조 누락"
fi

echo ""
echo "=============================================="
echo "MTU-N205 테스트 결과: ${PASS}/${TOTAL} 통과 (실패: ${FAIL})"
echo "=============================================="

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
