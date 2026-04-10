#!/bin/bash
# MTU-N206: 리소스 요청/제한 최적화 권고 E2E 테스트
# Design Ref: docs/02-design/mtus/MTU-N206-resource-optimization.design.md
# Plan SC: FR-N206.8
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
echo "MTU-N206: 리소스 요청/제한 최적화 권고 E2E 테스트"
echo "=============================================="

# --- E2E #1: CPU 효율 recording rules ---
echo ""
echo "--- E2E #1: FR-N206.1 CPU 효율 recording rules ---"
RULES_FILE="${INFRA_DIR}/resource-optimization/resource-optimization-rules.yaml"
if [ -f "$RULES_FILE" ]; then
  for metric in "resource_opt:cpu_utilization_ratio" "resource_opt:cpu_request_vs_usage"; do
    if grep -q "$metric" "$RULES_FILE"; then
      pass "$metric recording rule 존재"
    else
      fail "$metric recording rule 누락"
    fi
  done
else
  fail "Recording rules 파일 미존재: $RULES_FILE"
fi

# --- E2E #2: 메모리 효율 recording rules ---
echo ""
echo "--- E2E #2: FR-N206.2 메모리 효율 recording rules ---"
for metric in "resource_opt:memory_utilization_ratio" "resource_opt:memory_request_vs_usage"; do
  if grep -q "$metric" "$RULES_FILE"; then
    pass "$metric recording rule 존재"
  else
    fail "$metric recording rule 누락"
  fi
done

# --- E2E #3: Over-provisioning recording rules ---
echo ""
echo "--- E2E #3: FR-N206.3 Over-provisioning recording rules ---"
for metric in "resource_opt:cpu_over_provisioned_containers" "resource_opt:memory_over_provisioned_containers"; do
  if grep -q "$metric" "$RULES_FILE"; then
    pass "$metric recording rule 존재"
  else
    fail "$metric recording rule 누락"
  fi
done

# --- E2E #4: Under-provisioning recording rules ---
echo ""
echo "--- E2E #4: FR-N206.4 Under-provisioning recording rules ---"
for metric in "resource_opt:cpu_under_provisioned_containers" "resource_opt:memory_under_provisioned_containers" "resource_opt:cpu_throttle_ratio"; do
  if grep -q "$metric" "$RULES_FILE"; then
    pass "$metric recording rule 존재"
  else
    fail "$metric recording rule 누락"
  fi
done

# --- E2E #5: Over-provisioning 알림 ---
echo ""
echo "--- E2E #5: FR-N206.5 Over-provisioning 알림 ---"
ALERTS_FILE="${INFRA_DIR}/resource-optimization/resource-optimization-alerts.yaml"
if [ -f "$ALERTS_FILE" ]; then
  for alert in "ResourceCPUOverProvisioned" "ResourceMemoryOverProvisioned"; do
    if grep -q "$alert" "$ALERTS_FILE"; then
      pass "$alert 알림 규칙 존재"
    else
      fail "$alert 알림 규칙 누락"
    fi
  done
else
  fail "Alerting rules 파일 미존재: $ALERTS_FILE"
fi

# --- E2E #6: Under-provisioning / 스로틀링 알림 ---
echo ""
echo "--- E2E #6: FR-N206.6 Under-provisioning / 스로틀링 알림 ---"
for alert in "ResourceCPUUnderProvisioned" "ResourceMemoryUnderProvisioned" "ResourceCPUThrottlingHigh"; do
  if grep -q "$alert" "$ALERTS_FILE"; then
    pass "$alert 알림 규칙 존재"
  else
    fail "$alert 알림 규칙 누락"
  fi
done

# --- E2E #7: Grafana 대시보드 ---
echo ""
echo "--- E2E #7: FR-N206.7 Grafana 대시보드 ---"
DASHBOARD_FILE="${INFRA_DIR}/dashboards/resource-optimization-dashboard.json"
if [ -f "$DASHBOARD_FILE" ]; then
  pass "대시보드 파일 존재"
  if grep -q "resource_opt:namespace_cpu_efficiency" "$DASHBOARD_FILE"; then
    pass "CPU 효율 패널 포함"
  else
    fail "CPU 효율 패널 누락"
  fi
  if grep -q "resource_opt:namespace_memory_efficiency" "$DASHBOARD_FILE"; then
    pass "메모리 효율 패널 포함"
  else
    fail "메모리 효율 패널 누락"
  fi
  if grep -q "resource_opt:cpu_throttle_ratio" "$DASHBOARD_FILE"; then
    pass "스로틀링 패널 포함"
  else
    fail "스로틀링 패널 누락"
  fi
  if grep -q "resource_opt:cpu_over_provisioned" "$DASHBOARD_FILE"; then
    pass "Over-provisioning 패널 포함"
  else
    fail "Over-provisioning 패널 누락"
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

# --- 네임스페이스별 집계 존재 ---
echo ""
echo "--- 네임스페이스별 집계 검사 ---"
for metric in "resource_opt:namespace_cpu_efficiency" "resource_opt:namespace_memory_efficiency"; do
  if grep -q "$metric" "$RULES_FILE"; then
    pass "$metric 집계 규칙 존재"
  else
    fail "$metric 집계 규칙 누락"
  fi
done

echo ""
echo "=============================================="
echo "MTU-N206 테스트 결과: ${PASS}/${TOTAL} 통과 (실패: ${FAIL})"
echo "=============================================="

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
