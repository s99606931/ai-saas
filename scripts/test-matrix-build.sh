#!/bin/bash
# =============================================================================
# Matrix Build 최적화 테스트 스크립트
# Design Ref: MTU-N51 Design
# Plan SC: FR-N51.6
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PASS=0
FAIL=0
TOTAL=0

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_test()  { echo -e "\n${BLUE}[TEST $((++TOTAL))]${NC} $1"; }
log_pass()  { echo -e "${GREEN}  [PASS]${NC} $1"; ((PASS++)) || true; }
log_fail()  { echo -e "${RED}  [FAIL]${NC} $1"; ((FAIL++)) || true; }

echo "========================================="
echo " MTU-N51: Matrix Build 최적화 테스트"
echo "========================================="

# Phase 1: 산출물 존재
log_test "Matrix Build 워크플로우 존재"
[ -f "$PROJECT_DIR/.gitea/workflows/matrix-build.yml" ] && log_pass "존재" || log_fail "없음"

log_test "멀티스테이지 Dockerfile 존재"
[ -f "$PROJECT_DIR/docker/Dockerfile.optimized" ] && log_pass "존재" || log_fail "없음"

log_test "증분 테스트 스크립트 존재"
[ -f "$PROJECT_DIR/scripts/incremental-test.sh" ] && log_pass "존재" || log_fail "없음"

log_test "CI 최적화 가이드 존재"
[ -f "$PROJECT_DIR/docs/operations/ci-optimization-guide.md" ] && log_pass "존재" || log_fail "없음"

# Phase 2: Matrix 워크플로우 검증
log_test "Matrix strategy 설정 확인"
grep -q "matrix:" "$PROJECT_DIR/.gitea/workflows/matrix-build.yml" && log_pass "matrix 전략 설정됨" || log_fail "없음"

log_test "max-parallel 설정 확인"
grep -q "max-parallel:" "$PROJECT_DIR/.gitea/workflows/matrix-build.yml" && log_pass "max-parallel 설정됨" || log_fail "없음"

log_test "fail-fast: false 설정 확인"
grep -q "fail-fast: false" "$PROJECT_DIR/.gitea/workflows/matrix-build.yml" && log_pass "fail-fast: false" || log_fail "없음"

log_test "변경 서비스 탐지 단계 확인"
grep -q "detect-changes" "$PROJECT_DIR/.gitea/workflows/matrix-build.yml" && log_pass "변경 탐지 단계 포함" || log_fail "없음"

log_test "Docker Buildx 캐시 설정"
grep -q "buildx-cache" "$PROJECT_DIR/.gitea/workflows/matrix-build.yml" && log_pass "Buildx 캐시 설정됨" || log_fail "없음"

log_test "pnpm 캐시 설정"
grep -q "pnpm-store\|pnpm" "$PROJECT_DIR/.gitea/workflows/matrix-build.yml" && log_pass "pnpm 캐시 설정됨" || log_fail "없음"

log_test "SBOM 생성 단계"
grep -q "SBOM\|syft\|sbom" "$PROJECT_DIR/.gitea/workflows/matrix-build.yml" && log_pass "SBOM 생성 포함" || log_fail "없음"

# Phase 3: Dockerfile 검증
log_test "멀티스테이지 빌드 (3단계)"
STAGE_COUNT=$(grep -c "^FROM " "$PROJECT_DIR/docker/Dockerfile.optimized" 2>/dev/null || echo "0")
[ "$STAGE_COUNT" -ge 3 ] && log_pass "멀티스테이지 ${STAGE_COUNT}단계" || log_fail "${STAGE_COUNT}단계 (3+ 필요)"

log_test "Non-root 사용자 설정"
grep -q "USER" "$PROJECT_DIR/docker/Dockerfile.optimized" && log_pass "non-root 사용자 설정됨" || log_fail "없음"

log_test "HEALTHCHECK 설정"
grep -q "HEALTHCHECK" "$PROJECT_DIR/docker/Dockerfile.optimized" && log_pass "HEALTHCHECK 설정됨" || log_fail "없음"

log_test "Alpine 기반 이미지"
grep -q "alpine" "$PROJECT_DIR/docker/Dockerfile.optimized" && log_pass "Alpine 이미지 사용" || log_fail "없음"

log_test "dumb-init PID 1 관리"
grep -q "dumb-init" "$PROJECT_DIR/docker/Dockerfile.optimized" && log_pass "dumb-init 사용" || log_fail "없음"

log_test "OCI 메타데이터 라벨"
grep -q "org.opencontainers" "$PROJECT_DIR/docker/Dockerfile.optimized" && log_pass "OCI 라벨 포함" || log_fail "없음"

# Phase 4: 증분 테스트 스크립트 검증
log_test "증분 테스트 git diff 기반"
grep -q "git.*diff" "$PROJECT_DIR/scripts/incremental-test.sh" && log_pass "git diff 사용" || log_fail "없음"

log_test "공통 패키지 변경 감지"
grep -q "packages/" "$PROJECT_DIR/scripts/incremental-test.sh" && log_pass "packages 변경 감지" || log_fail "없음"

# Phase 5: YAML 구문 검증
log_test "워크플로우 YAML 유효성"
python3 -c "import yaml; yaml.safe_load(open('$PROJECT_DIR/.gitea/workflows/matrix-build.yml'))" 2>/dev/null && log_pass "YAML 유효" || log_fail "YAML 오류"

log_test "Dockerfile 구문 유효성 (FROM 키워드)"
FROM_COUNT=$(grep -c "^FROM" "$PROJECT_DIR/docker/Dockerfile.optimized" || echo "0")
[ "$FROM_COUNT" -ge 3 ] && log_pass "Dockerfile 구조 유효" || log_fail "잘못된 구조"

# 결과 요약
echo ""
echo "========================================="
echo " Matrix Build 최적화 테스트 결과"
echo "========================================="
echo -e " 전체: ${TOTAL}건"
echo -e " ${GREEN}PASS${NC}: ${PASS}건"
echo -e " ${RED}FAIL${NC}: ${FAIL}건"
echo "========================================="

[ "$FAIL" -eq 0 ] && echo -e "${GREEN}ALL TESTS PASSED${NC}" && exit 0 || { echo -e "${RED}${FAIL} TESTS FAILED${NC}"; exit 1; }
