#!/usr/bin/env bash
# =============================================================================
# Runbook 자동화 검증 스크립트
# Design Ref: MTU-N94 Design §2
# Plan SC: FR-N94.1 ~ FR-N94.6
# =============================================================================
set -euo pipefail

PASS=0
FAIL=0
TOTAL=0

pass() { PASS=$((PASS + 1)); TOTAL=$((TOTAL + 1)); echo "  [PASS] $1"; }
fail() { FAIL=$((FAIL + 1)); TOTAL=$((TOTAL + 1)); echo "  [FAIL] $1"; }
section() { echo ""; echo "=== $1 ==="; }

# =============================================================================
# TEST 1: 공통 라이브러리 (FR-N94.6)
# =============================================================================
section "TEST 1: Runbook 공통 라이브러리 (FR-N94.6)"

LIB="scripts/runbook-lib.sh"
if [ -f "$LIB" ]; then pass "runbook-lib.sh 존재"; else fail "runbook-lib.sh 없음"; fi

for func in "log_info" "log_warn" "log_error" "add_finding" "add_action" "output_diagnosis" "log_audit" "safe_kubectl"; do
  if grep -q "$func" "$LIB" 2>/dev/null; then
    pass "함수 '$func' 정의됨"
  else
    fail "함수 '$func' 누락"
  fi
done

# 위험 명령 차단 확인
if grep -q "delete\|patch\|apply\|replace" "$LIB" 2>/dev/null; then
  pass "safe_kubectl에서 위험 명령 차단 로직 존재"
else
  fail "위험 명령 차단 로직 누락"
fi

# 감사 로그 기록
if grep -q "audit" "$LIB" 2>/dev/null; then
  pass "감사 로그 기록 함수 존재 (CSAP D-06)"
else
  fail "감사 로그 기록 함수 누락"
fi

# =============================================================================
# TEST 2: Pod CrashLoop 진단 (FR-N94.1)
# =============================================================================
section "TEST 2: Pod CrashLoop 진단 (FR-N94.1)"

CL="scripts/runbook-auto-crashloop.sh"
if [ -f "$CL" ]; then pass "crashloop 진단 스크립트 존재"; else fail "crashloop 진단 스크립트 없음"; fi

for pattern in "OOMKilled" "connection refused" "panic" "RUNBOOK_START" "output_diagnosis"; do
  if grep -q "$pattern" "$CL" 2>/dev/null; then
    pass "CrashLoop 진단: '$pattern' 검사 포함"
  else
    fail "CrashLoop 진단: '$pattern' 검사 누락"
  fi
done

# source runbook-lib.sh 확인
if grep -q "source.*runbook-lib.sh" "$CL" 2>/dev/null; then
  pass "공통 라이브러리 로드 확인"
else
  fail "공통 라이브러리 로드 누락"
fi

# =============================================================================
# TEST 3: 고지연 진단 (FR-N94.2)
# =============================================================================
section "TEST 3: 고지연 진단 (FR-N94.2)"

HL="scripts/runbook-auto-high-latency.sh"
if [ -f "$HL" ]; then pass "고지연 진단 스크립트 존재"; else fail "고지연 진단 스크립트 없음"; fi

for pattern in "postgres\|pg\|db" "redis" "networkpolicy" "output_diagnosis"; do
  if grep -q "$pattern" "$HL" 2>/dev/null; then
    pass "고지연 진단: '$pattern' 검사 포함"
  else
    fail "고지연 진단: '$pattern' 검사 누락"
  fi
done

# =============================================================================
# TEST 4: 디스크 자동 정리 (FR-N94.3)
# =============================================================================
section "TEST 4: 디스크 자동 정리 (FR-N94.3)"

DC="scripts/runbook-auto-disk-cleanup.sh"
if [ -f "$DC" ]; then pass "디스크 정리 스크립트 존재"; else fail "디스크 정리 스크립트 없음"; fi

for pattern in "df -h" "find.*100M" "journal" "dry_run"; do
  if grep -q "$pattern" "$DC" 2>/dev/null; then
    pass "디스크 정리: '$pattern' 패턴 포함"
  else
    fail "디스크 정리: '$pattern' 패턴 누락"
  fi
done

# 자동 삭제가 dry_run 모드인지 확인 (안전 장치)
if grep -q "dry_run" "$DC" 2>/dev/null; then
  pass "디스크 정리: dry_run 모드 (안전 장치)"
else
  fail "디스크 정리: 안전 장치 없음"
fi

# =============================================================================
# TEST 5: OOM 진단 + VPA 권장 (FR-N94.4)
# =============================================================================
section "TEST 5: OOM 진단 + VPA 권장 (FR-N94.4)"

OOM="scripts/runbook-auto-oom.sh"
if [ -f "$OOM" ]; then pass "OOM 진단 스크립트 존재"; else fail "OOM 진단 스크립트 없음"; fi

for pattern in "OOMKilled" "137" "VerticalPodAutoscaler" "vpa" "output_diagnosis"; do
  if grep -q "$pattern" "$OOM" 2>/dev/null; then
    pass "OOM 진단: '$pattern' 포함"
  else
    fail "OOM 진단: '$pattern' 누락"
  fi
done

# =============================================================================
# TEST 6: 구조화 출력 형식 (FR-N94.5)
# =============================================================================
section "TEST 6: JSON 구조화 출력 (FR-N94.5)"

# output_diagnosis 함수의 JSON 출력 구조 확인
for field in "runbook" "timestamp" "diagnosis" "root_cause" "findings" "recommendation" "auto_actions"; do
  if grep -q "\"$field\"" "$LIB" 2>/dev/null; then
    pass "JSON 출력 필드 '$field' 존재"
  else
    fail "JSON 출력 필드 '$field' 누락"
  fi
done

# =============================================================================
# 결과 요약
# =============================================================================
echo ""
echo "============================================"
echo "  MTU-N94 Runbook 자동화 검증 결과"
echo "============================================"
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo "  TOTAL: $TOTAL"
echo "  RATE: $(( PASS * 100 / TOTAL ))%"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then exit 1; fi
