#!/bin/bash
# API 문서 자동 생성 E2E 테스트
# Design Ref: DS-N106.5
# Plan SC: FR-N106.5

set -uo pipefail

PASS=0
FAIL=0
TOTAL=0

pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "[FAIL] $1: $2"; }

echo "============================================"
echo " MTU-N106: API 문서 자동 생성 E2E 테스트"
echo "============================================"
echo ""

# E2E-N106.1: OpenAPI 스펙 파일 검증
echo "--- E2E-N106.1: OpenAPI 스펙 검증 ---"
SPEC="/data/ai-saas/docs-portal/static/openapi/ai-saas-api.yaml"

if [ -f "$SPEC" ]; then
  pass "OpenAPI 스펙 파일 존재"
else
  fail "OpenAPI 스펙 파일 누락" "$SPEC"
fi

if grep -q 'openapi: "3.1.0"' "$SPEC"; then
  pass "OpenAPI 3.1.0 버전 확인"
else
  fail "OpenAPI 버전 미확인" "3.1.0 필요"
fi

if grep -q "bearerAuth" "$SPEC"; then
  pass "JWT Bearer 인증 스키마 정의"
else
  fail "인증 스키마 미정의" "CSAP D-08"
fi

if grep -q "/auth/login" "$SPEC"; then
  pass "인증 API 엔드포인트 포함"
else
  fail "인증 API 누락" "필수 엔드포인트"
fi

if grep -q "/audit/logs" "$SPEC"; then
  pass "감사 로그 API 엔드포인트 포함 (CSAP D-06)"
else
  fail "감사 로그 API 누락" "CSAP D-06 필수"
fi

if grep -q "/ai/chat" "$SPEC"; then
  pass "AI 서비스 API 엔드포인트 포함"
else
  fail "AI API 누락" "N2SF O등급 문서화"
fi

if grep -q "N2SF" "$SPEC"; then
  pass "N2SF 데이터 등급 설명 포함"
else
  fail "N2SF 설명 누락" "데이터 등급 문서화 필요"
fi

ENDPOINT_COUNT=$(grep -c "operationId:" "$SPEC" || true)
if [ "$ENDPOINT_COUNT" -ge 10 ]; then
  pass "API 엔드포인트 10개 이상 ($ENDPOINT_COUNT개)"
else
  fail "API 엔드포인트 부족" "${ENDPOINT_COUNT}개 (10개 이상 필요)"
fi

# E2E-N106.2: 문서 생성 스크립트 검증
echo ""
echo "--- E2E-N106.2: 문서 생성 스크립트 검증 ---"
SCRIPT="/data/ai-saas/scripts/generate-api-docs.sh"

if [ -f "$SCRIPT" ]; then
  pass "문서 생성 스크립트 존재"
else
  fail "스크립트 누락" "$SCRIPT"
fi

if [ -x "$SCRIPT" ]; then
  pass "스크립트 실행 권한 확인"
else
  fail "실행 권한 없음" "chmod +x 필요"
fi

# E2E-N106.3: CI 워크플로우 검증
echo ""
echo "--- E2E-N106.3: CI 워크플로우 검증 ---"
WF="/data/ai-saas/.gitea/workflows/api-docs-gen.yaml"

if [ -f "$WF" ]; then
  pass "CI 워크플로우 파일 존재"
else
  fail "워크플로우 누락" "$WF"
fi

if grep -q "openapi" "$WF"; then
  pass "OpenAPI 경로 트리거 설정"
else
  fail "트리거 미설정" "openapi 경로 변경 감지 필요"
fi

if grep -q "audit" "$WF"; then
  pass "감사 로그 기록 스텝 존재"
else
  fail "감사 로그 미설정" "CSAP D-06"
fi

# E2E-N106.4: CSAP 준수 검증
echo ""
echo "--- E2E-N106.4: CSAP/N2SF 준수 검증 ---"

if grep -q "D-08" "$SPEC"; then
  pass "CSAP D-08 접근 통제 참조 포함"
else
  fail "D-08 참조 누락" "접근 통제 문서화"
fi

if grep -q "D-06" "$SPEC"; then
  pass "CSAP D-06 감사 로그 참조 포함"
else
  fail "D-06 참조 누락" "감사 로그 문서화"
fi

# 시크릿 하드코딩 검사
if ! grep -rE "(api[_-]?key|password|secret|token)\s*[:=]\s*['\"][a-zA-Z0-9]{10}" "$SPEC" "$SCRIPT" "$WF" 2>/dev/null | grep -v "example:" | grep -v "format:" | grep -q .; then
  pass "시크릿 하드코딩 없음"
else
  fail "시크릿 하드코딩 발견" "환경 변수 사용 필수"
fi

# 결과 요약
echo ""
echo "============================================"
echo " 테스트 결과: ${PASS}/${TOTAL} 통과 (실패: ${FAIL})"
echo "============================================"

if [ $FAIL -gt 0 ]; then
  exit 1
fi

MATCH_RATE=$(echo "scale=1; $PASS * 100 / $TOTAL" | bc)
echo "matchRate: ${MATCH_RATE}%"
echo "[PASS] MTU-N106 E2E 테스트 모두 통과"
