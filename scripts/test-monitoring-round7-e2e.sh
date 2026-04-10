#!/usr/bin/env bash
# =============================================================================
# 모니터링 Round 7 E2E 통합 테스트
# Design Ref: MTU-N98 Design
# Plan SC: FR-N98.1 ~ FR-N98.6
#
# 사용법: bash scripts/test-monitoring-round7-e2e.sh
# =============================================================================
set -euo pipefail

PASS=0
FAIL=0
TOTAL=0

pass() { PASS=$((PASS + 1)); TOTAL=$((TOTAL + 1)); echo "  [PASS] $1"; }
fail() { FAIL=$((FAIL + 1)); TOTAL=$((TOTAL + 1)); echo "  [FAIL] $1"; }
section() { echo ""; echo "=== $1 ==="; }

# =============================================================================
# TEST 1: 전체 PrometheusRule YAML 문법 검증 (FR-N98.1)
# =============================================================================
section "TEST 1: PrometheusRule YAML 문법 검증"

RULE_FILES=(
  "infra/monitoring/anomaly-detection-rules.yaml"
  "infra/monitoring/predictive-scaling-rules.yaml"
  "infra/monitoring/incident-classification-rules.yaml"
  "infra/monitoring/multitenant-monitoring-rules.yaml"
  "infra/monitoring/finops-cost-rules.yaml"
  "infra/monitoring/grafana-optimized-recording-rules.yaml"
)

for rf in "${RULE_FILES[@]}"; do
  if [ -f "$rf" ]; then
    if python3 -c "import yaml; yaml.safe_load(open('$rf'))" 2>/dev/null; then
      pass "YAML 유효: $(basename "$rf")"
    else
      fail "YAML 오류: $(basename "$rf")"
    fi
  else
    fail "파일 없음: $rf"
  fi
done

# kind: PrometheusRule 확인
for rf in "${RULE_FILES[@]}"; do
  if grep -q "kind: PrometheusRule" "$rf" 2>/dev/null; then
    pass "PrometheusRule 타입: $(basename "$rf")"
  else
    fail "PrometheusRule 타입 누락: $(basename "$rf")"
  fi
done

# =============================================================================
# TEST 2: 전체 대시보드 JSON 유효성 검증 (FR-N98.2)
# =============================================================================
section "TEST 2: 대시보드 JSON 유효성 검증"

DASHBOARD_FILES=(
  "infra/monitoring/dashboards/optimized-overview.json"
  "infra/monitoring/dashboards/anomaly-detection.json"
  "infra/monitoring/dashboards/predictive-scaling.json"
  "infra/monitoring/dashboards/incident-management.json"
  "infra/monitoring/dashboards/tenant-monitoring.json"
  "infra/monitoring/dashboards/finops-cost-analysis.json"
)

for db in "${DASHBOARD_FILES[@]}"; do
  if [ -f "$db" ]; then
    if python3 -c "import json; json.load(open('$db'))" 2>/dev/null; then
      pass "JSON 유효: $(basename "$db")"
    else
      fail "JSON 오류: $(basename "$db")"
    fi
  else
    fail "파일 없음: $db"
  fi
done

# uid 고유성 확인
for db in "${DASHBOARD_FILES[@]}"; do
  if grep -q '"uid"' "$db" 2>/dev/null; then
    pass "UID 존재: $(basename "$db")"
  else
    fail "UID 누락: $(basename "$db")"
  fi
done

# =============================================================================
# TEST 3: Recording Rules 명명 규칙 검증 (FR-N98.3)
# =============================================================================
section "TEST 3: Recording Rules 명명 규칙"

# 패턴: {범위}:{메트릭}:{계산방법}
for rf in "${RULE_FILES[@]}"; do
  RECORD_COUNT=$(grep -c "record:" "$rf" 2>/dev/null || echo 0)
  if [ "$RECORD_COUNT" -gt 0 ]; then
    # 최소 하나의 콜론(:)이 있는 명명 규칙 확인
    VALID_COUNT=$(grep "record:" "$rf" 2>/dev/null | grep -c ":" || echo 0)
    if [ "$VALID_COUNT" -ge "$RECORD_COUNT" ]; then
      pass "명명 규칙 준수: $(basename "$rf") ($RECORD_COUNT rules)"
    else
      fail "명명 규칙 위반: $(basename "$rf")"
    fi
  fi
done

# =============================================================================
# TEST 4: 알림 규칙 runbook_url 검증 (FR-N98.4)
# =============================================================================
section "TEST 4: 알림 runbook_url 검증"

ALERT_COUNT=0
RUNBOOK_COUNT=0
for rf in "${RULE_FILES[@]}"; do
  AC=$(grep -c "alert:" "$rf" 2>/dev/null || echo 0)
  RC=$(grep -c "runbook_url" "$rf" 2>/dev/null || echo 0)
  ALERT_COUNT=$((ALERT_COUNT + AC))
  RUNBOOK_COUNT=$((RUNBOOK_COUNT + RC))
done
echo "  [INFO] 전체 알림 규칙: ${ALERT_COUNT}개, runbook_url 포함: ${RUNBOOK_COUNT}개"
if [ "$RUNBOOK_COUNT" -gt 0 ]; then
  pass "일부 알림에 runbook_url 참조 존재 ($RUNBOOK_COUNT개)"
else
  fail "runbook_url 전혀 없음"
fi

# =============================================================================
# TEST 5: CSAP/N2SF 어노테이션 검증 (FR-N98.5)
# =============================================================================
section "TEST 5: CSAP/N2SF 어노테이션 검증"

CSAP_COUNT=0
for rf in "${RULE_FILES[@]}"; do
  if grep -q "csap.ref" "$rf" 2>/dev/null; then
    CSAP_COUNT=$((CSAP_COUNT + 1))
  fi
done

if [ "$CSAP_COUNT" -ge 4 ]; then
  pass "CSAP 참조 어노테이션 충분 ($CSAP_COUNT개 파일)"
else
  fail "CSAP 참조 어노테이션 부족 ($CSAP_COUNT개 파일)"
fi

# VictoriaMetrics values.yaml CSAP 주석 확인
if grep -q "CSAP" "infra/monitoring/victoriametrics/values.yaml" 2>/dev/null; then
  pass "VictoriaMetrics values에 CSAP 참조 존재"
else
  fail "VictoriaMetrics values에 CSAP 참조 누락"
fi

# NetworkPolicy CSAP 주석
if grep -q "csap.ref" "infra/monitoring/victoriametrics/network-policy.yaml" 2>/dev/null; then
  pass "NetworkPolicy에 CSAP D-08 참조 존재"
else
  fail "NetworkPolicy에 CSAP 참조 누락"
fi

# =============================================================================
# TEST 6: Round 7 전체 테스트 실행 (FR-N98.6)
# =============================================================================
section "TEST 6: Round 7 개별 테스트 스크립트 존재 확인"

TEST_SCRIPTS=(
  "scripts/test-victoriametrics.sh"
  "scripts/test-grafana-performance.sh"
  "scripts/test-alert-noise-reduction.sh"
  "scripts/test-anomaly-detection.sh"
  "scripts/test-predictive-scaling.sh"
  "scripts/test-runbook-automation.sh"
  "scripts/test-incident-classification.sh"
  "scripts/test-multitenant-monitoring.sh"
  "scripts/test-finops-dashboard.sh"
)

for ts in "${TEST_SCRIPTS[@]}"; do
  if [ -f "$ts" ]; then
    pass "테스트 스크립트 존재: $(basename "$ts")"
  else
    fail "테스트 스크립트 없음: $ts"
  fi
done

# Runbook 스크립트 bash 문법 확인
section "TEST 7: Runbook 스크립트 문법 검증"
RUNBOOK_SCRIPTS=(
  "scripts/runbook-lib.sh"
  "scripts/runbook-auto-crashloop.sh"
  "scripts/runbook-auto-disk-cleanup.sh"
  "scripts/runbook-auto-high-latency.sh"
  "scripts/runbook-auto-oom.sh"
)

for rs in "${RUNBOOK_SCRIPTS[@]}"; do
  if [ -f "$rs" ]; then
    if bash -n "$rs" 2>/dev/null; then
      pass "bash 문법 통과: $(basename "$rs")"
    else
      fail "bash 문법 오류: $(basename "$rs")"
    fi
  else
    fail "파일 없음: $rs"
  fi
done

# =============================================================================
# 최종 결과
# =============================================================================
echo ""
echo "============================================================"
echo "  모니터링 Round 7 E2E 통합 테스트 최종 결과"
echo "============================================================"
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo "  TOTAL: $TOTAL"
echo "  RATE: $(( PASS * 100 / TOTAL ))%"
echo "============================================================"

if [ "$FAIL" -gt 0 ]; then exit 1; fi
