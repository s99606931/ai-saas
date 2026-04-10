#!/bin/bash
# MTU-N204: Scheduler 성능 모니터링 E2E 테스트
# Design Ref: docs/02-design/mtus/MTU-N204-scheduler-performance.design.md
# Plan SC: FR-N204.7
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
echo "MTU-N204: Scheduler 성능 모니터링 E2E 테스트"
echo "=============================================="

# --- E2E #1: 스케줄링 알고리즘 레이턴시 recording rules ---
echo ""
echo "--- E2E #1: FR-N204.1 스케줄링 알고리즘 레이턴시 ---"
RULES_FILE="${INFRA_DIR}/scheduler/scheduler-performance-rules.yaml"
if [ -f "$RULES_FILE" ]; then
  for metric in "scheduler_perf:algorithm_duration_p50" "scheduler_perf:algorithm_duration_p90" "scheduler_perf:algorithm_duration_p99" "scheduler_perf:e2e_scheduling_duration_p99"; do
    if grep -q "$metric" "$RULES_FILE"; then
      pass "$metric recording rule 존재"
    else
      fail "$metric recording rule 누락"
    fi
  done
else
  fail "Recording rules 파일 미존재: $RULES_FILE"
fi

# --- E2E #2: 대기 Pod recording rules ---
echo ""
echo "--- E2E #2: FR-N204.2 대기 Pod recording rules ---"
for metric in "scheduler_perf:pending_pods_by_queue"; do
  if grep -q "$metric" "$RULES_FILE"; then
    pass "$metric recording rule 존재"
  else
    fail "$metric recording rule 누락"
  fi
done

# --- E2E #3: 스케줄링 시도/실패 recording rules ---
echo ""
echo "--- E2E #3: FR-N204.3 스케줄링 시도/실패 recording rules ---"
for metric in "scheduler_perf:schedule_attempts_rate" "scheduler_perf:schedule_failure_rate" "scheduler_perf:unschedulable_pods_count"; do
  if grep -q "$metric" "$RULES_FILE"; then
    pass "$metric recording rule 존재"
  else
    fail "$metric recording rule 누락"
  fi
done

# --- E2E #4: 스케줄링 레이턴시 알림 ---
echo ""
echo "--- E2E #4: FR-N204.4 스케줄링 레이턴시 알림 ---"
ALERTS_FILE="${INFRA_DIR}/scheduler/scheduler-performance-alerts.yaml"
if [ -f "$ALERTS_FILE" ]; then
  for alert in "SchedulerLatencyHigh" "SchedulerLatencyCritical"; do
    if grep -q "$alert" "$ALERTS_FILE"; then
      pass "$alert 알림 규칙 존재"
    else
      fail "$alert 알림 규칙 누락"
    fi
  done
else
  fail "Alerting rules 파일 미존재: $ALERTS_FILE"
fi

# --- E2E #5: 대기 Pod / 실패율 알림 ---
echo ""
echo "--- E2E #5: FR-N204.5 대기 Pod / 실패율 알림 ---"
for alert in "SchedulerPendingPodsHigh" "SchedulerFailureRateHigh"; do
  if grep -q "$alert" "$ALERTS_FILE"; then
    pass "$alert 알림 규칙 존재"
  else
    fail "$alert 알림 규칙 누락"
  fi
done

# --- E2E #6: Grafana 대시보드 ---
echo ""
echo "--- E2E #6: FR-N204.6 Grafana 대시보드 ---"
DASHBOARD_FILE="${INFRA_DIR}/dashboards/scheduler-performance-dashboard.json"
if [ -f "$DASHBOARD_FILE" ]; then
  pass "대시보드 파일 존재"
  if grep -q "scheduler_perf:algorithm_duration" "$DASHBOARD_FILE"; then
    pass "스케줄링 알고리즘 레이턴시 패널 포함"
  else
    fail "스케줄링 알고리즘 레이턴시 패널 누락"
  fi
  if grep -q "scheduler_perf:pending_pods" "$DASHBOARD_FILE"; then
    pass "대기 Pod 패널 포함"
  else
    fail "대기 Pod 패널 누락"
  fi
  if grep -q "scheduler_perf:schedule_failure_rate" "$DASHBOARD_FILE"; then
    pass "실패율 패널 포함"
  else
    fail "실패율 패널 누락"
  fi
else
  fail "대시보드 파일 미존재: $DASHBOARD_FILE"
fi

# --- YAML/JSON 유효성 검사 ---
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
echo "MTU-N204 테스트 결과: ${PASS}/${TOTAL} 통과 (실패: ${FAIL})"
echo "=============================================="

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
