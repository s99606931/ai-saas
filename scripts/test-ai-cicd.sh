#!/bin/bash
# ============================================================
# MTU-N77: AI 기반 CI/CD 파이프라인 통합 검증 테스트
# Plan SC: FR-N77.5
# ============================================================

set -euo pipefail

PASS=0
FAIL=0
TOTAL=12

log_pass() { echo "  [PASS] $1"; PASS=$((PASS+1)); }
log_fail() { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }

echo "============================================================"
echo "MTU-N77: AI 기반 CI/CD 파이프라인 통합 검증"
echo "날짜: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
echo ""

BASE=/data/ai-saas/infra/cicd

# AI-01: 빌드 분석 워크플로우 존재
echo "[AI-01] AI 빌드 분석 워크플로우 확인"
if [ -f "$BASE/ai-build-analysis.yaml" ] && grep -q 'AI Build Failure Analysis' "$BASE/ai-build-analysis.yaml"; then
  log_pass "빌드 분석 워크플로우 존재"
else
  log_fail "빌드 분석 워크플로우 미존재"
fi

# AI-02: LM Studio 엔드포인트 설정
echo "[AI-02] LM Studio 엔드포인트 확인"
if grep -q 'host.docker.internal:1234' "$BASE/ai-build-analysis.yaml" 2>/dev/null; then
  log_pass "LM Studio 엔드포인트 설정됨"
else
  log_fail "LM Studio 엔드포인트 미설정"
fi

# AI-03: PR 리뷰 워크플로우 존재
echo "[AI-03] AI PR 리뷰 워크플로우 확인"
if [ -f "$BASE/ai-pr-review.yaml" ] && grep -q 'AI PR Code Review' "$BASE/ai-pr-review.yaml"; then
  log_pass "PR 리뷰 워크플로우 존재"
else
  log_fail "PR 리뷰 워크플로우 미존재"
fi

# AI-04: CSAP 기반 리뷰 프롬프트
echo "[AI-04] CSAP 기반 리뷰 프롬프트 확인"
if grep -q 'CSAP' "$BASE/ai-pr-review.yaml" 2>/dev/null && grep -q 'OWASP' "$BASE/ai-pr-review.yaml"; then
  log_pass "CSAP + OWASP 기반 리뷰 프롬프트 설정"
else
  log_fail "보안 기준 프롬프트 미설정"
fi

# AI-05: PII 마스킹 필터 존재
echo "[AI-05] PII 마스킹 필터 확인"
if [ -f "$BASE/ai-security-filter.sh" ] && [ -x "$BASE/ai-security-filter.sh" ]; then
  log_pass "PII 마스킹 필터 존재 + 실행 가능"
else
  log_fail "PII 마스킹 필터 미존재 또는 실행 불가"
fi

# AI-06: IP 주소 마스킹 검증
echo "[AI-06] IP 주소 마스킹 기능 검증"
RESULT=$(echo "서버 192.168.1.100 접속 오류" | bash "$BASE/ai-security-filter.sh" -)
if echo "$RESULT" | grep -q 'MASKED-IP'; then
  log_pass "IP 주소 마스킹 동작 확인"
else
  log_fail "IP 주소 마스킹 미동작"
fi

# AI-07: 이메일 마스킹 검증
echo "[AI-07] 이메일 마스킹 기능 검증"
RESULT=$(echo "user@example.com 로그인 실패" | bash "$BASE/ai-security-filter.sh" -)
if echo "$RESULT" | grep -q 'MASKED-EMAIL'; then
  log_pass "이메일 마스킹 동작 확인"
else
  log_fail "이메일 마스킹 미동작"
fi

# AI-08: API 키 마스킹 검증
echo "[AI-08] API 키 마스킹 기능 검증"
RESULT=$(echo "key=ghp_abcdefghijklmnopqrst1234567890 test" | bash "$BASE/ai-security-filter.sh" -)
if echo "$RESULT" | grep -qE 'MASKED-KEY|MASKED-SECRET|MASKED-BASE64'; then
  log_pass "API 키 마스킹 동작 확인 (패턴 매칭)"
else
  log_fail "API 키 마스킹 미동작: $RESULT"
fi

# AI-09: N2SF C등급 데이터 차단 검증
echo "[AI-09] N2SF C등급 데이터 차단 검증"
RESULT=$(echo "주민등록번호: 900101-1234567" | bash "$BASE/ai-security-filter.sh" - 2>&1 || true)
if echo "$RESULT" | grep -q 'C등급 데이터 감지'; then
  log_pass "C등급 데이터 차단 동작 확인"
else
  log_fail "C등급 데이터 차단 미동작"
fi

# AI-10: N2SF S등급 데이터 차단 검증
echo "[AI-10] N2SF S등급 데이터 차단 검증"
RESULT=$(echo "국방 기밀 문서" | bash "$BASE/ai-security-filter.sh" - 2>&1 || true)
if echo "$RESULT" | grep -q 'S등급 데이터 감지'; then
  log_pass "S등급 데이터 차단 동작 확인"
else
  log_fail "S등급 데이터 차단 미동작"
fi

# AI-11: 빌드 분석 워크플로우 failure 조건
echo "[AI-11] 빌드 분석 failure 트리거 조건 확인"
if grep -q 'conclusion.*failure' "$BASE/ai-build-analysis.yaml" 2>/dev/null; then
  log_pass "failure 트리거 조건 설정됨"
else
  log_fail "failure 트리거 미설정"
fi

# AI-12: 워크플로우 한국어 프롬프트
echo "[AI-12] 한국어 프롬프트 설정 확인"
if grep -q '한국어' "$BASE/ai-build-analysis.yaml" 2>/dev/null && grep -q '한국어' "$BASE/ai-pr-review.yaml"; then
  log_pass "한국어 프롬프트 설정 확인"
else
  log_fail "한국어 프롬프트 미설정"
fi

echo ""
echo "============================================================"
echo "MTU-N77 AI CI/CD 파이프라인 검증 결과"
echo "============================================================"
echo "  통과: ${PASS} / ${TOTAL}"
echo "  실패: ${FAIL} / ${TOTAL}"
echo "  매치율: $(( PASS * 100 / TOTAL ))%"
echo "============================================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
