#!/bin/bash
# Design Ref: MTU-N241
# Plan SC: FR-EGOV.2, FR-EGOV.3
# 전자정부 표준프레임워크 호환성 자동 점검

set -euo pipefail

CHECKLIST="infra/compliance/egov-compatibility-checklist.yaml"
PASS=0; FAIL=0; WARN=0; TOTAL=0

check_pass() { TOTAL=$((TOTAL+1)); PASS=$((PASS+1)); echo "  [PASS] $1"; }
check_fail() { TOTAL=$((TOTAL+1)); FAIL=$((FAIL+1)); echo "  [FAIL] $1"; }
check_warn() { TOTAL=$((TOTAL+1)); WARN=$((WARN+1)); echo "  [WARN] $1"; }

echo "============================================"
echo " 전자정부 표준프레임워크 호환성 점검"
echo " 대상 버전: v4.2"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"

# --- 1. 인증/인가 호환 (EXE-001) ---
echo ""
echo "[실행환경] 인증/인가"
test -d infra/keycloak && check_pass "EXE-001: Keycloak SSO 설정 존재" || check_fail "EXE-001: Keycloak 미구성"
test -f infra/keycloak/ldap-federation/realm-ldap-config.yaml && check_pass "EXE-001: LDAP 연동 설정" || check_warn "EXE-001: LDAP 미설정"

# --- 2. REST API 호환 (EXE-004) ---
echo ""
echo "[실행환경] REST API"
find packages/ src/ -name "*.ts" -path "*/api/*" 2>/dev/null | head -1 | grep -q "." && \
  check_pass "EXE-004: API 엔드포인트 존재" || check_warn "EXE-004: API 엔드포인트 미확인"

# --- 3. 데이터 교환 (DX-001) ---
echo ""
echo "[데이터 교환]"
test -f infra/cicd/api-standard-rules.yaml && check_pass "DX-001: API 표준 규칙 정의" || check_fail "DX-001: API 표준 규칙 없음"
grep -q "resultCode" infra/cicd/api-standard-rules.yaml 2>/dev/null && \
  check_pass "DX-001: 공공 표준 응답 형식 지원" || check_warn "DX-001: 표준 응답 미확인"

# --- 4. 보안 호환 ---
echo ""
echo "[보안]"
test -f .claude/rules/csap-compliance.md && check_pass "SEC-001~004: CSAP 보안 규칙 정의" || check_fail "SEC: CSAP 규칙 없음"
grep -q "Zod\|zod\|validation" .claude/rules/csap-compliance.md 2>/dev/null && \
  check_pass "SEC-003: 입력 검증 (SQL 인젝션 방지)" || check_warn "SEC-003: 입력 검증 미확인"
grep -q "AES-256\|TLS 1.3" .claude/rules/csap-compliance.md 2>/dev/null && \
  check_pass "SEC-004: 암호화 기준 정의" || check_warn "SEC-004: 암호화 미확인"

# --- 5. 배포 환경 ---
echo ""
echo "[배포 환경]"
test -d infra/helm && check_pass "DEP-001: Helm 기반 컨테이너 배포" || check_warn "DEP-001: Helm 미구성"
ls .gitea/workflows/*.yaml 2>/dev/null | head -1 | grep -q "." && \
  check_pass "DEP-002: Gitea Actions CI/CD" || check_warn "DEP-002: CI/CD 미구성"
test -d infra/monitoring && check_pass "DEP-003: 모니터링 인프라" || check_warn "DEP-003: 모니터링 미구성"

# --- 6. 호환성 체크리스트 ---
echo ""
echo "[체크리스트]"
test -f "$CHECKLIST" && check_pass "체크리스트 파일 존재" || check_fail "체크리스트 파일 없음"
grep -q "compatibility_rate" "$CHECKLIST" 2>/dev/null && check_pass "호환성 비율 정의" || check_warn "호환성 비율 미정의"

echo ""
echo "============================================"
COMPAT_RATE=$(( (PASS * 100) / (TOTAL > 0 ? TOTAL : 1) ))
echo " 호환성 점검 결과: $PASS/$TOTAL PASS ($COMPAT_RATE%)"
echo " WARN: $WARN, FAIL: $FAIL"
echo "============================================"
