#!/bin/bash
# 정책 엔진 성능 모니터링 검증 스크립트
# Design Ref: MTU-N236 §3.7
# Plan SC: FR-N236.9
set -euo pipefail

PASS=0
FAIL=0
WARN=0
TOTAL=0

print_header() {
  echo "=============================================="
  echo " 정책 엔진 성능 모니터링 검증 (MTU-N236)"
  echo " 실행 시각: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "=============================================="
  echo ""
}

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

print_header

# ── 1. Kyverno 성능 Recording Rules 검증 ──
echo "[1/6] Kyverno 성능 Recording Rules"
KYVERNO_RULES="infra/monitoring/kyverno-performance-rules.yaml"
if [ -f "$KYVERNO_RULES" ]; then
  check "파일 존재: $KYVERNO_RULES" "PASS"

  # YAML 구문 검증
  if command -v python3 &>/dev/null; then
    if python3 -c "import yaml; yaml.safe_load(open('$KYVERNO_RULES'))" 2>/dev/null; then
      check "YAML 구문 유효성" "PASS"
    else
      check "YAML 구문 유효성" "FAIL"
    fi
  else
    check "YAML 구문 유효성 (python3 없음)" "WARN"
  fi

  # 필수 recording rule 확인
  for rule in "kyverno:admission_review:p50" "kyverno:admission_review:p95" "kyverno:admission_review:p99" \
              "kyverno:policy_results:rate5m" "kyverno:policy_error:ratio" \
              "kyverno:cpu:usage_cores" "kyverno:memory:usage_bytes"; do
    if grep -q "$rule" "$KYVERNO_RULES"; then
      check "Recording rule: $rule" "PASS"
    else
      check "Recording rule: $rule" "FAIL"
    fi
  done
else
  check "파일 존재: $KYVERNO_RULES" "FAIL"
fi
echo ""

# ── 2. Gatekeeper 성능 Recording Rules 검증 ──
echo "[2/6] Gatekeeper 성능 Recording Rules"
GK_RULES="infra/monitoring/gatekeeper-performance-rules.yaml"
if [ -f "$GK_RULES" ]; then
  check "파일 존재: $GK_RULES" "PASS"

  if command -v python3 &>/dev/null; then
    if python3 -c "import yaml; yaml.safe_load(open('$GK_RULES'))" 2>/dev/null; then
      check "YAML 구문 유효성" "PASS"
    else
      check "YAML 구문 유효성" "FAIL"
    fi
  else
    check "YAML 구문 유효성 (python3 없음)" "WARN"
  fi

  for rule in "gatekeeper:validation:p50" "gatekeeper:validation:p95" "gatekeeper:validation:p99" \
              "gatekeeper:violations:by_constraint" "gatekeeper:violations:total" \
              "gatekeeper:audit:duration_seconds" "gatekeeper:audit:staleness_seconds" \
              "gatekeeper:cpu:usage_cores" "gatekeeper:memory:usage_bytes"; do
    if grep -q "$rule" "$GK_RULES"; then
      check "Recording rule: $rule" "PASS"
    else
      check "Recording rule: $rule" "FAIL"
    fi
  done
else
  check "파일 존재: $GK_RULES" "FAIL"
fi
echo ""

# ── 3. Policy Reporter 성능 Rules 검증 ──
echo "[3/6] Policy Reporter 성능 Rules"
PR_RULES="infra/monitoring/policy-reporter-performance-rules.yaml"
if [ -f "$PR_RULES" ]; then
  check "파일 존재: $PR_RULES" "PASS"

  if command -v python3 &>/dev/null; then
    if python3 -c "import yaml; yaml.safe_load(open('$PR_RULES'))" 2>/dev/null; then
      check "YAML 구문 유효성" "PASS"
    else
      check "YAML 구문 유효성" "FAIL"
    fi
  else
    check "YAML 구문 유효성 (python3 없음)" "WARN"
  fi

  for rule in "policy_reporter:send:p95" "policy_reporter:send:p99" \
              "policy_reporter:queue:size" "policy_reporter:cpu:usage_cores"; do
    if grep -q "$rule" "$PR_RULES"; then
      check "Recording rule: $rule" "PASS"
    else
      check "Recording rule: $rule" "FAIL"
    fi
  done
else
  check "파일 존재: $PR_RULES" "FAIL"
fi
echo ""

# ── 4. 알림 규칙 검증 ──
echo "[4/6] 정책 엔진 알림 규칙"
ALERTS="infra/monitoring/policy-engine-performance-alerts.yaml"
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

  for alert in "KyvernoAdmissionLatencyHigh" "KyvernoAdmissionLatencyCritical" \
               "GatekeeperValidationLatencyHigh" "GatekeeperAuditStale" \
               "PolicyEngineErrorRateHigh"; do
    if grep -q "$alert" "$ALERTS"; then
      check "알림 규칙: $alert" "PASS"
    else
      check "알림 규칙: $alert" "FAIL"
    fi
  done

  # severity 레이블 확인
  for sev in "warning" "critical"; do
    if grep -q "severity: $sev" "$ALERTS"; then
      check "심각도 레이블: $sev" "PASS"
    else
      check "심각도 레이블: $sev" "FAIL"
    fi
  done

  # CSAP 참조 확인
  if grep -q "csap_control" "$ALERTS"; then
    check "CSAP 통제항목 참조" "PASS"
  else
    check "CSAP 통제항목 참조" "FAIL"
  fi
else
  check "파일 존재: $ALERTS" "FAIL"
fi
echo ""

# ── 5. Grafana 대시보드 검증 ──
echo "[5/6] Grafana 대시보드"
DASHBOARD="infra/monitoring/dashboards/policy-engine-performance.json"
if [ -f "$DASHBOARD" ]; then
  check "파일 존재: $DASHBOARD" "PASS"

  # JSON 구문 검증
  if command -v python3 &>/dev/null; then
    if python3 -c "import json; json.load(open('$DASHBOARD'))" 2>/dev/null; then
      check "JSON 구문 유효성" "PASS"
    else
      check "JSON 구문 유효성" "FAIL"
    fi
  else
    check "JSON 구문 유효성 (python3 없음)" "WARN"
  fi

  # 필수 패널 확인
  PANEL_COUNT=$(grep -c '"title"' "$DASHBOARD" || true)
  if [ "$PANEL_COUNT" -ge 8 ]; then
    check "대시보드 패널 수: ${PANEL_COUNT}개 (최소 8개)" "PASS"
  else
    check "대시보드 패널 수: ${PANEL_COUNT}개 (최소 8개 필요)" "FAIL"
  fi

  # 태그 확인
  for tag in "policy-engine" "kyverno" "gatekeeper"; do
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

# ── 6. 문서 완전성 검증 ──
echo "[6/6] 문서 완전성"
PLAN="docs/01-plan/mtus/MTU-N236.plan.md"
DESIGN="docs/02-design/mtus/MTU-N236.design.md"

if [ -f "$PLAN" ]; then
  check "Plan 문서 존재" "PASS"
  if grep -q "FR-N236" "$PLAN"; then
    check "Plan FR ID 체계" "PASS"
  else
    check "Plan FR ID 체계" "FAIL"
  fi
else
  check "Plan 문서 존재" "FAIL"
fi

if [ -f "$DESIGN" ]; then
  check "Design 문서 존재" "PASS"
  if grep -q "Design Anchor" "$DESIGN"; then
    check "Design Anchor 섹션" "PASS"
  else
    check "Design Anchor 섹션" "FAIL"
  fi
else
  check "Design 문서 존재" "FAIL"
fi
echo ""

# ── 결과 요약 ──
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
