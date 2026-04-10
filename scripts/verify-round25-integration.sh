#!/bin/bash
# Round 25 통합 검증 스크립트
# Design Ref: MTU-N240
# Plan SC: FR-N240.4
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
echo " Round 25 통합 검증"
echo " 실행 시각: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="
echo ""

# ── 1. 개별 MTU 산출물 ──
echo "[1/3] 개별 MTU 산출물 존재 확인"
for f in "infra/monitoring/kyverno-performance-rules.yaml" \
         "infra/monitoring/gatekeeper-performance-rules.yaml" \
         "infra/monitoring/policy-reporter-performance-rules.yaml" \
         "infra/monitoring/policy-engine-performance-alerts.yaml" \
         "infra/monitoring/velero-performance-rules.yaml" \
         "infra/monitoring/velero-performance-alerts.yaml" \
         "infra/monitoring/falco-performance-rules.yaml" \
         "infra/monitoring/falco-performance-alerts.yaml" \
         "infra/monitoring/keda-performance-rules.yaml" \
         "infra/monitoring/keda-performance-alerts.yaml" \
         "infra/monitoring/dashboards/policy-engine-performance.json" \
         "infra/monitoring/dashboards/velero-backup-performance.json" \
         "infra/monitoring/dashboards/falco-runtime-security.json" \
         "infra/monitoring/dashboards/keda-autoscaler-performance.json"; do
  if [ -f "$f" ]; then
    check "$f" "PASS"
  else
    check "$f" "FAIL"
  fi
done
echo ""

# ── 2. 통합 산출물 ──
echo "[2/3] 통합 산출물"
CROSS="infra/monitoring/round25-cross-reference-rules.yaml"
ROUTING="infra/monitoring/round25-alert-routing.yaml"

for f in "$CROSS" "$ROUTING"; do
  if [ -f "$f" ]; then
    check "파일 존재: $f" "PASS"
    if python3 -c "import yaml; yaml.safe_load(open('$f'))" 2>/dev/null; then
      check "YAML 유효성: $f" "PASS"
    else
      check "YAML 유효성: $f" "FAIL"
    fi
  else
    check "파일 존재: $f" "FAIL"
  fi
done

# 교차 참조 규칙 내용 확인
for rule in "round25:policy_engine:health" "round25:backup:health" \
            "round25:runtime_security:health" "round25:autoscaling:health" \
            "round25:security_infra:overall_health" \
            "round25:csap:d06:compliance" "round25:csap:d08:compliance" \
            "round25:csap:d10:compliance" "round25:csap:d12:compliance" \
            "round25:admission:total_latency_p99"; do
  if grep -q "$rule" "$CROSS"; then
    check "교차 참조 규칙: $rule" "PASS"
  else
    check "교차 참조 규칙: $rule" "FAIL"
  fi
done

# 알림 라우팅 확인
for alert in "Round25SecurityInfraHealthLow" "Round25AdmissionPipelineLatencyHigh" \
             "Round25CsapComplianceLow"; do
  if grep -q "$alert" "$ROUTING"; then
    check "알림 라우팅: $alert" "PASS"
  else
    check "알림 라우팅: $alert" "FAIL"
  fi
done
echo ""

# ── 3. 문서 완전성 ──
echo "[3/3] 문서 완전성"
for doc in "docs/01-plan/mtus/MTU-N240.plan.md" "docs/02-design/mtus/MTU-N240.design.md"; do
  if [ -f "$doc" ]; then
    check "문서: $doc" "PASS"
  else
    check "문서: $doc" "FAIL"
  fi
done
echo ""

echo "=============================================="
echo " 검증 결과 요약"
echo "=============================================="
echo "  전체: $TOTAL"
echo "  통과: $PASS"
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
