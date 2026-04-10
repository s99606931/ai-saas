#!/bin/bash
# Design Ref: MTU-N240
# Plan SC: FR-API.1 ~ FR-API.5
# 공공 API 표준 자동 검증 스크립트

set -euo pipefail

SPEC_FILE="${1:-}"
RULES_FILE="${2:-infra/cicd/api-standard-rules.yaml}"
OUTPUT_FORMAT="${3:-text}"  # text | json

PASS=0; FAIL=0; WARN=0; TOTAL=0

check_pass() { TOTAL=$((TOTAL+1)); PASS=$((PASS+1)); echo "  [PASS] $1"; }
check_fail() { TOTAL=$((TOTAL+1)); FAIL=$((FAIL+1)); echo "  [FAIL] $1"; }
check_warn() { TOTAL=$((TOTAL+1)); WARN=$((WARN+1)); echo "  [WARN] $1"; }

usage() {
  echo "사용법: $0 <openapi-spec.yaml|json> [rules-file] [text|json]"
  exit 1
}

[ -z "$SPEC_FILE" ] && usage
[ ! -f "$SPEC_FILE" ] && echo "ERROR: 스펙 파일 없음: $SPEC_FILE" && exit 1

echo "============================================"
echo " 공공 API 표준 검증"
echo " 스펙: $SPEC_FILE"
echo " 규칙: $RULES_FILE"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"

# --- OAS-001: API 버전 정보 ---
echo ""
echo "[규칙] OpenAPI 스펙 구조 검증 (FR-API.1)"
if grep -q '"version"' "$SPEC_FILE" || grep -q "version:" "$SPEC_FILE"; then
  check_pass "OAS-001: info.version 정의됨"
else
  check_fail "OAS-001: info.version 누락"
fi

# --- OAS-005: operationId ---
if grep -q "operationId" "$SPEC_FILE"; then
  check_pass "OAS-005: operationId 사용"
else
  check_warn "OAS-005: operationId 미사용 (권장)"
fi

# --- SEC-001: securitySchemes ---
echo ""
echo "[규칙] 보안 표준 검증 (FR-API.3)"
if grep -q "securitySchemes" "$SPEC_FILE"; then
  check_pass "SEC-001: securitySchemes 정의됨"
else
  check_fail "SEC-001: securitySchemes 미정의"
fi

# --- SEC-002: security 적용 ---
if grep -q "security:" "$SPEC_FILE" || grep -q '"security"' "$SPEC_FILE"; then
  check_pass "SEC-002: security 적용됨"
else
  check_fail "SEC-002: security 미적용"
fi

# --- SEC-003: HTTPS ---
if grep -q "https://" "$SPEC_FILE"; then
  check_pass "SEC-003: HTTPS URL 사용"
else
  check_warn "SEC-003: HTTPS URL 미확인"
fi

# --- 표준 응답 형식 ---
echo ""
echo "[규칙] 공공 API 표준 응답 형식 (FR-API.2)"
if grep -q "resultCode" "$SPEC_FILE"; then
  check_pass "RES-001: resultCode 필드 정의"
else
  check_warn "RES-001: resultCode 필드 미정의 (공공 표준 권장)"
fi

if grep -q "resultMsg" "$SPEC_FILE"; then
  check_pass "RES-002: resultMsg 필드 정의"
else
  check_warn "RES-002: resultMsg 필드 미정의 (공공 표준 권장)"
fi

# --- 표준 에러 코드 ---
echo ""
echo "[규칙] 표준 에러 코드 정의"
for code in 400 401 403 404 500; do
  if grep -q "\"$code\"" "$SPEC_FILE" || grep -q "'$code'" "$SPEC_FILE" || grep -q "$code:" "$SPEC_FILE"; then
    check_pass "ERR-$code: HTTP $code 응답 정의됨"
  else
    check_warn "ERR-$code: HTTP $code 응답 미정의"
  fi
done

# --- 버전 관리 ---
echo ""
echo "[규칙] API 버전 관리 (FR-API.4)"
if grep -q "/api/v" "$SPEC_FILE" || grep -q "/v[0-9]" "$SPEC_FILE"; then
  check_pass "VER-001: API 버전 경로 포함"
else
  check_warn "VER-001: API 버전 경로 미포함"
fi

# --- 결과 요약 ---
echo ""
echo "============================================"
echo " 검증 결과 요약"
echo "============================================"
echo " 전체: $TOTAL 항목"
echo " PASS: $PASS"
echo " FAIL: $FAIL"
echo " WARN: $WARN"
echo ""
COMPLIANCE_RATE=$(( (PASS * 100) / (TOTAL > 0 ? TOTAL : 1) ))
echo " 준수율: ${COMPLIANCE_RATE}%"
echo "============================================"

# JSON 출력
if [ "$OUTPUT_FORMAT" = "json" ]; then
  echo ""
  cat <<JSONEOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "specFile": "$SPEC_FILE",
  "total": $TOTAL,
  "pass": $PASS,
  "fail": $FAIL,
  "warn": $WARN,
  "complianceRate": $COMPLIANCE_RATE
}
JSONEOF
fi

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
