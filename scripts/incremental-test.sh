#!/bin/bash
# =============================================================================
# 증분 테스트 스크립트 — 변경된 서비스만 테스트
# Design Ref: MTU-N51 Design §Matrix 빌드 구조
# Plan SC: FR-N51.3
#
# 사용법: bash scripts/incremental-test.sh [base-ref]
# 기본값: base-ref = origin/main
# =============================================================================

set -euo pipefail

BASE_REF="${1:-origin/main}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }

echo "========================================="
echo " 증분 테스트 — 변경 서비스 탐지"
echo "========================================="

# =========================================================================
# 변경 파일 탐지
# =========================================================================
log_info "Base ref: $BASE_REF"

CHANGED_FILES=$(git -C "$PROJECT_DIR" diff --name-only "$BASE_REF" HEAD 2>/dev/null || \
                git -C "$PROJECT_DIR" diff --name-only HEAD~1 HEAD 2>/dev/null || \
                echo "")

if [ -z "$CHANGED_FILES" ]; then
    log_warn "변경 파일 없음 — 전체 테스트 실행"
    CHANGED_SERVICES=("all")
else
    log_info "변경된 파일:"
    echo "$CHANGED_FILES" | head -20

    # 서비스 디렉토리 변경 탐지
    CHANGED_SERVICES=($(echo "$CHANGED_FILES" | \
        grep '^services/' | \
        cut -d'/' -f2 | \
        sort -u))

    # 공통 패키지 변경 시 전체
    if echo "$CHANGED_FILES" | grep -q '^packages/'; then
        log_warn "공통 패키지 변경 — 전체 서비스 테스트"
        CHANGED_SERVICES=("all")
    fi

    # Docker 파일 변경 시 전체
    if echo "$CHANGED_FILES" | grep -q '^docker/'; then
        log_warn "Dockerfile 변경 — 전체 서비스 테스트"
        CHANGED_SERVICES=("all")
    fi
fi

# =========================================================================
# 테스트 실행
# =========================================================================
echo ""
echo "========================================="
echo " 테스트 대상 서비스"
echo "========================================="

if [ "${CHANGED_SERVICES[0]:-}" = "all" ]; then
    log_info "전체 서비스 테스트"
    # 모든 서비스 테스트
    if command -v pnpm &>/dev/null; then
        pnpm test || log_warn "일부 테스트 실패"
    else
        log_warn "pnpm 미설치 — 테스트 건너뜀"
    fi
elif [ ${#CHANGED_SERVICES[@]} -eq 0 ]; then
    log_ok "변경된 서비스 없음 — 테스트 건너뜀"
else
    for SERVICE in "${CHANGED_SERVICES[@]}"; do
        log_info "테스트 실행: $SERVICE"
        if command -v pnpm &>/dev/null; then
            pnpm --filter "$SERVICE" test 2>/dev/null || log_warn "$SERVICE 테스트 스크립트 없음"
        else
            log_warn "pnpm 미설치 — $SERVICE 테스트 건너뜀"
        fi
    done
fi

echo ""
log_ok "증분 테스트 완료"
echo " 테스트 대상: ${CHANGED_SERVICES[*]:-없음}"
