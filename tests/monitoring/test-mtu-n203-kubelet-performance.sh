#!/bin/bash
# MTU-N203: Kubelet 성능 모니터링 E2E 테스트
# Design Ref: docs/02-design/mtus/MTU-N203-kubelet-performance.design.md
# Plan SC: FR-N203.7
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
echo "MTU-N203: Kubelet 성능 모니터링 E2E 테스트"
echo "=============================================="

# --- E2E #1: Pod 기동 시간 recording rules 존재 ---
echo ""
echo "--- E2E #1: FR-N203.1 Pod 기동 시간 recording rules ---"
RULES_FILE="${INFRA_DIR}/kubelet/kubelet-performance-rules.yaml"
if [ -f "$RULES_FILE" ]; then
  for metric in "kubelet_perf:pod_start_duration_p50" "kubelet_perf:pod_start_duration_p90" "kubelet_perf:pod_start_duration_p99"; do
    if grep -q "$metric" "$RULES_FILE"; then
      pass "$metric recording rule 존재"
    else
      fail "$metric recording rule 누락"
    fi
  done
else
  fail "Recording rules 파일 미존재: $RULES_FILE"
fi

# --- E2E #2: PLEG relist recording rules 존재 ---
echo ""
echo "--- E2E #2: FR-N203.2 PLEG relist recording rules ---"
for metric in "kubelet_perf:pleg_relist_duration_p50" "kubelet_perf:pleg_relist_duration_p90" "kubelet_perf:pleg_relist_duration_p99"; do
  if grep -q "$metric" "$RULES_FILE"; then
    pass "$metric recording rule 존재"
  else
    fail "$metric recording rule 누락"
  fi
done

# --- E2E #3: 런타임 작업 레이턴시 recording rules ---
echo ""
echo "--- E2E #3: FR-N203.3 런타임 작업 레이턴시 recording rules ---"
for metric in "kubelet_perf:runtime_operations_duration_p99" "kubelet_perf:runtime_operations_errors_rate"; do
  if grep -q "$metric" "$RULES_FILE"; then
    pass "$metric recording rule 존재"
  else
    fail "$metric recording rule 누락"
  fi
done

# --- E2E #4: Pod 기동 SLO 알림 존재 ---
echo ""
echo "--- E2E #4: FR-N203.4 Pod 기동 SLO 알림 ---"
ALERTS_FILE="${INFRA_DIR}/kubelet/kubelet-performance-alerts.yaml"
if [ -f "$ALERTS_FILE" ]; then
  for alert in "KubeletPodStartSlow" "KubeletPodStartVerySlow"; do
    if grep -q "$alert" "$ALERTS_FILE"; then
      pass "$alert 알림 규칙 존재"
    else
      fail "$alert 알림 규칙 누락"
    fi
  done
else
  fail "Alerting rules 파일 미존재: $ALERTS_FILE"
fi

# --- E2E #5: PLEG relist 알림 존재 ---
echo ""
echo "--- E2E #5: FR-N203.5 PLEG relist 알림 ---"
for alert in "KubeletPLEGRelistSlow" "KubeletPLEGRelistStuck" "KubeletRuntimeOperationErrors"; do
  if grep -q "$alert" "$ALERTS_FILE"; then
    pass "$alert 알림 규칙 존재"
  else
    fail "$alert 알림 규칙 누락"
  fi
done

# --- E2E #6: Grafana 대시보드 존재 ---
echo ""
echo "--- E2E #6: FR-N203.6 Grafana 대시보드 ---"
DASHBOARD_FILE="${INFRA_DIR}/dashboards/kubelet-performance-dashboard.json"
if [ -f "$DASHBOARD_FILE" ]; then
  pass "대시보드 파일 존재"
  if grep -q "kubelet_perf:pod_start_duration" "$DASHBOARD_FILE"; then
    pass "Pod 기동 시간 패널 포함"
  else
    fail "Pod 기동 시간 패널 누락"
  fi
  if grep -q "kubelet_perf:pleg_relist_duration" "$DASHBOARD_FILE"; then
    pass "PLEG relist 패널 포함"
  else
    fail "PLEG relist 패널 누락"
  fi
  if grep -q "kubelet_perf:runtime_operations" "$DASHBOARD_FILE"; then
    pass "런타임 작업 패널 포함"
  else
    fail "런타임 작업 패널 누락"
  fi
else
  fail "대시보드 파일 미존재: $DASHBOARD_FILE"
fi

# --- YAML 유효성 검사 ---
echo ""
echo "--- YAML 유효성 검사 ---"
for file in "$RULES_FILE" "$ALERTS_FILE"; do
  if python3 -c "import yaml; yaml.safe_load(open('$file'))" 2>/dev/null; then
    pass "$(basename $file) YAML 유효"
  else
    fail "$(basename $file) YAML 무효"
  fi
done

# --- JSON 유효성 검사 ---
if python3 -c "import json; json.load(open('$DASHBOARD_FILE'))" 2>/dev/null; then
  pass "대시보드 JSON 유효"
else
  fail "대시보드 JSON 무효"
fi

# --- CSAP 참조 검사 ---
echo ""
echo "--- CSAP 참조 검사 ---"
if grep -q "csap.*D-10" "$ALERTS_FILE"; then
  pass "CSAP D-10 참조 존재"
else
  fail "CSAP D-10 참조 누락"
fi

# --- 결과 요약 ---
echo ""
echo "=============================================="
echo "MTU-N203 테스트 결과: ${PASS}/${TOTAL} 통과 (실패: ${FAIL})"
echo "=============================================="

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
