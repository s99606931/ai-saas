#!/bin/bash
# 아키텍처 다이어그램 자동 업데이트 E2E 테스트
# Plan SC: FR-N111.5

set -uo pipefail
PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "[FAIL] $1: $2"; }

echo "============================================"
echo " MTU-N111: 아키텍처 다이어그램 자동 업데이트 E2E"
echo "============================================"
echo ""

echo "--- FR-N111.1: 스캔 스크립트 ---"
F="/data/ai-saas/scripts/generate-arch-diagram.sh"
[ -f "$F" ] && pass "스캔 스크립트 존재" || fail "스크립트 누락" "$F"
[ -x "$F" ] && pass "실행 권한 확인" || fail "실행 권한 없음" ""
grep -q "INFRA_DIR" "$F" && pass "인프라 디렉토리 참조" || fail "인프라 미참조" ""
grep -q "SECURITY_COMPONENTS" "$F" && pass "보안 컴포넌트 분류" || fail "분류 누락" ""
grep -q "MONITORING_COMPONENTS" "$F" && pass "모니터링 컴포넌트 분류" || fail "분류 누락" ""
grep -q "CICD_COMPONENTS" "$F" && pass "CI/CD 컴포넌트 분류" || fail "분류 누락" ""

echo ""
echo "--- FR-N111.2: 생성된 다이어그램 ---"
F="/data/ai-saas/docs-portal/docs/architecture/platform-overview.md"
[ -f "$F" ] && pass "아키텍처 문서 파일 존재" || fail "파일 누락" "$F"
grep -q "mermaid" "$F" && pass "Mermaid 다이어그램 포함" || fail "Mermaid 미포함" ""
grep -q "graph TB" "$F" && pass "Top-Bottom 그래프 레이아웃" || fail "레이아웃 오류" ""
grep -q "보안" "$F" && pass "보안 계층 서브그래프" || fail "보안 계층 누락" ""
grep -q "모니터링" "$F" && pass "모니터링 계층 서브그래프" || fail "모니터링 계층 누락" ""
grep -q "CI/CD" "$F" && pass "CI/CD 계층 서브그래프" || fail "CI/CD 계층 누락" ""

# 컴포넌트 수 확인
COMP_COUNT=$(grep -c "infra/" "$F" || true)
[ "$COMP_COUNT" -ge 30 ] && pass "30개 이상 컴포넌트 문서화 ($COMP_COUNT개)" || fail "컴포넌트 부족" "$COMP_COUNT"

grep -q "자동 생성" "$F" && pass "자동 생성 메타데이터 포함" || fail "메타데이터 누락" ""
grep -q "컴포넌트 수:" "$F" && pass "컴포넌트 수 기록" || fail "컴포넌트 수 미기록" ""

echo ""
echo "--- FR-N111.3: CI 워크플로우 ---"
F="/data/ai-saas/.gitea/workflows/arch-diagram-update.yaml"
[ -f "$F" ] && pass "CI 워크플로우 파일 존재" || fail "파일 누락" "$F"
grep -q "infra/\*\*" "$F" && pass "인프라 경로 트리거" || fail "트리거 미설정" ""
grep -q "generate-arch-diagram" "$F" && pass "생성 스크립트 호출" || fail "스크립트 미호출" ""
grep -q "audit" "$F" && pass "감사 로그 기록" || fail "감사 로그 누락" ""

echo ""
echo "============================================"
echo " 테스트 결과: ${PASS}/${TOTAL} 통과 (실패: ${FAIL})"
echo "============================================"
[ $FAIL -gt 0 ] && exit 1
MATCH_RATE=$(echo "scale=1; $PASS * 100 / $TOTAL" | bc)
echo "matchRate: ${MATCH_RATE}%"
echo "[PASS] MTU-N111 E2E 테스트 모두 통과"
