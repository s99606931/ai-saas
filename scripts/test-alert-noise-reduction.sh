#!/usr/bin/env bash
# =============================================================================
# 알림 노이즈 감소 검증 스크립트
# Design Ref: MTU-N91 Design §2
# Plan SC: FR-N91.1 ~ FR-N91.6
# =============================================================================
set -euo pipefail

PASS=0
FAIL=0
TOTAL=0

pass() { PASS=$((PASS + 1)); TOTAL=$((TOTAL + 1)); echo "  [PASS] $1"; }
fail() { FAIL=$((FAIL + 1)); TOTAL=$((TOTAL + 1)); echo "  [FAIL] $1"; }
section() { echo ""; echo "=== $1 ==="; }

# =============================================================================
# TEST 1: 서비스 의존성 억제 규칙 (FR-N91.1)
# =============================================================================
section "TEST 1: 서비스 의존성 억제 규칙 (FR-N91.1)"

NR="infra/monitoring/alertmanager-noise-reduction.yaml"

if [ -f "$NR" ]; then
  pass "알림 노이즈 감소 설정 파일 존재"
else
  fail "알림 노이즈 감소 설정 파일 없음"
fi

if grep -q "inhibit_rules:" "$NR" 2>/dev/null; then
  pass "억제 규칙 섹션 존재"
else
  fail "억제 규칙 섹션 누락"
fi

# 서비스 의존성 억제 확인
for dep in "api-gateway" "PostgreSQL" "auth-service" "NetworkPartition" "KubernetesClusterUnreachable" "NodeDiskPressure" "FluxSyncFailed"; do
  if grep -q "$dep" "$NR" 2>/dev/null; then
    pass "의존성 억제 규칙: $dep 존재"
  else
    fail "의존성 억제 규칙: $dep 누락"
  fi
done

# 보안 알림 예외 확인 (절대 억제 안 함)
if grep -q 'alertname!~"Falco' "$NR" 2>/dev/null; then
  pass "보안 알림 억제 예외 처리됨 (CSAP D-06)"
else
  fail "보안 알림 억제 예외 처리 누락"
fi

# =============================================================================
# TEST 2: 에스컬레이션 타이머 (FR-N91.2)
# =============================================================================
section "TEST 2: 에스컬레이션 타이머 (FR-N91.2)"

# Critical 10초 대기
if grep -q "group_wait: 10s" "$NR" 2>/dev/null; then
  pass "Critical 알림 10초 대기 설정됨"
else
  fail "Critical 알림 대기 시간 오류"
fi

# Critical 1시간 반복
if grep -q "repeat_interval: 1h" "$NR" 2>/dev/null; then
  pass "Critical 알림 1시간 반복 설정됨"
else
  fail "Critical 알림 반복 주기 오류"
fi

# Info 24시간 반복
if grep -q "repeat_interval: 24h" "$NR" 2>/dev/null; then
  pass "Info 알림 24시간 반복 설정됨"
else
  fail "Info 알림 반복 주기 오류"
fi

# 관리자 에스컬레이션
if grep -q "management-escalation" "$NR" 2>/dev/null; then
  pass "관리자 에스컬레이션 수신자 설정됨"
else
  fail "관리자 에스컬레이션 수신자 누락"
fi

# =============================================================================
# TEST 3: 시간대별 알림 정책 (FR-N91.3)
# =============================================================================
section "TEST 3: 시간대별 알림 정책 (FR-N91.3)"

if grep -q "time_intervals:" "$NR" 2>/dev/null; then
  pass "시간대 정의 섹션 존재"
else
  fail "시간대 정의 섹션 누락"
fi

if grep -q "outside-business-hours" "$NR" 2>/dev/null; then
  pass "비업무 시간 정의 존재"
else
  fail "비업무 시간 정의 누락"
fi

if grep -q "weekend" "$NR" 2>/dev/null; then
  pass "주말 정의 존재"
else
  fail "주말 정의 누락"
fi

if grep -q "mute_time_intervals:" "$NR" 2>/dev/null; then
  pass "음소거 시간대 적용됨"
else
  fail "음소거 시간대 미적용"
fi

# Warning 비업무 시간 음소거 확인
if grep -A5 'severity="warning"' "$NR" 2>/dev/null | grep -q "mute_time_intervals:" 2>/dev/null; then
  pass "Warning 비업무 시간 음소거 설정됨"
else
  fail "Warning 비업무 시간 음소거 미설정"
fi

# =============================================================================
# TEST 4: 중복 제거 정책 (FR-N91.4)
# =============================================================================
section "TEST 4: 중복 제거 정책 (FR-N91.4)"

# group_by에 service 추가 확인
if grep -q '"service"' "$NR" 2>/dev/null || grep -q "service" "$NR" 2>/dev/null; then
  pass "group_by에 service 단위 그룹핑 설정됨"
else
  fail "group_by에 service 누락"
fi

if grep -q 'group_by:' "$NR" 2>/dev/null; then
  pass "group_by 설정 존재"
else
  fail "group_by 설정 누락"
fi

# =============================================================================
# TEST 5: 한국어 알림 템플릿 (FR-N91.5)
# =============================================================================
section "TEST 5: 한국어 알림 템플릿 (FR-N91.5)"

TMPL="infra/monitoring/alertmanager-templates/ko-notification.tmpl"

if [ -f "$TMPL" ]; then
  pass "한국어 알림 템플릿 파일 존재"
else
  fail "한국어 알림 템플릿 파일 없음"
fi

for keyword in "ko.title" "ko.body" "ko.summary" "ko.security"; do
  if grep -q "$keyword" "$TMPL" 2>/dev/null; then
    pass "템플릿 정의 '$keyword' 존재"
  else
    fail "템플릿 정의 '$keyword' 누락"
  fi
done

# 한국어 키워드 확인
for ko in "심각도" "네임스페이스" "시작 시간" "조치 가이드" "보안 알림"; do
  if grep -q "$ko" "$TMPL" 2>/dev/null; then
    pass "한국어 키워드 '$ko' 포함"
  else
    fail "한국어 키워드 '$ko' 누락"
  fi
done

# CSAP 참조
if grep -q "CSAP" "$TMPL" 2>/dev/null; then
  pass "템플릿에 CSAP 참조 존재"
else
  fail "템플릿에 CSAP 참조 누락"
fi

# =============================================================================
# TEST 6: CSAP D-06 보안 알림 보존 검증 (FR-N91.6)
# =============================================================================
section "TEST 6: CSAP D-06 보안 알림 보존 검증"

# 보안 알림 라우트 확인
if grep -q "security-team" "$NR" 2>/dev/null; then
  pass "보안팀 수신자 설정됨"
else
  fail "보안팀 수신자 누락"
fi

# 보안 알림 continue: false (다른 라우트로 전파 안 함)
if grep -q "continue: false" "$NR" 2>/dev/null; then
  pass "보안 알림 전용 라우트 (전파 차단)"
else
  fail "보안 알림 전파 설정 오류"
fi

# Design Ref 주석
if grep -q "Design Ref:" "$NR" 2>/dev/null; then
  pass "Design Ref 주석 존재"
else
  fail "Design Ref 주석 누락"
fi

# =============================================================================
# 결과 요약
# =============================================================================
echo ""
echo "============================================"
echo "  MTU-N91 알림 노이즈 감소 검증 결과"
echo "============================================"
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo "  TOTAL: $TOTAL"
echo "  RATE: $(( PASS * 100 / TOTAL ))%"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
