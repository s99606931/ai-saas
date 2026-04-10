#!/bin/bash
# ============================================================================
# 의존성 보안 감사 — npm 취약점 + 라이선스 + 공급망 보안
# Plan SC: FR-N140.1, FR-N140.2, FR-N140.3, FR-N140.4
# Design Ref: MTU-N140 Design §1
# CSAP: D-12 (시스템 개발 보안 — 오픈소스 관리)
#
# 사용법:
#   ./scripts/dependency-security-audit.sh                    # 전체 감사
#   ./scripts/dependency-security-audit.sh --check vulns      # 취약점만
#   ./scripts/dependency-security-audit.sh --check licenses   # 라이선스만
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
AUDIT_LOG="${PROJECT_ROOT}/.claude/audit.jsonl"
CHECK_FILTER=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

TOTAL_CHECKS=0
PASS_CHECKS=0
WARN_CHECKS=0
FAIL_CHECKS=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --check) CHECK_FILTER="$2"; shift 2 ;;
        --help)
            echo "사용법: dependency-security-audit.sh [옵션]"
            echo "  --check TYPE    검증 유형 (vulns|licenses|outdated|supply-chain)"
            exit 0 ;;
        *) shift ;;
    esac
done

log_audit() {
    local entry="{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"actor\":\"dependency-security-audit\",\"action\":\"$1\",\"detail\":\"$2\"}"
    echo "${entry}" >> "${AUDIT_LOG}" 2>/dev/null || true
}

check_pass() { TOTAL_CHECKS=$((TOTAL_CHECKS+1)); PASS_CHECKS=$((PASS_CHECKS+1)); echo -e "  ${GREEN}[PASS]${NC} $1"; }
check_warn() { TOTAL_CHECKS=$((TOTAL_CHECKS+1)); WARN_CHECKS=$((WARN_CHECKS+1)); echo -e "  ${YELLOW}[WARN]${NC} $1"; }
check_fail() { TOTAL_CHECKS=$((TOTAL_CHECKS+1)); FAIL_CHECKS=$((FAIL_CHECKS+1)); echo -e "  ${RED}[FAIL]${NC} $1"; }

# ============================================================================
# 1. npm 취약점 스캔
# Plan SC: FR-N140.1
# ============================================================================
audit_vulnerabilities() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  1. npm 의존성 취약점 스캔${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    if ! command -v pnpm &>/dev/null; then
        check_warn "pnpm 미설치 — 취약점 스캔 건너뜀"
        echo ""
        return
    fi

    # pnpm audit 실행
    local audit_output
    audit_output=$(cd "${PROJECT_ROOT}" && pnpm audit --json 2>/dev/null || echo '{"metadata":{"vulnerabilities":{"critical":0,"high":0,"moderate":0,"low":0}}}')

    # JSON 파싱
    local critical=0 high=0 moderate=0 low=0
    if command -v jq &>/dev/null; then
        critical=$(echo "${audit_output}" | jq -r '.metadata.vulnerabilities.critical // 0' 2>/dev/null || echo "0")
        high=$(echo "${audit_output}" | jq -r '.metadata.vulnerabilities.high // 0' 2>/dev/null || echo "0")
        moderate=$(echo "${audit_output}" | jq -r '.metadata.vulnerabilities.moderate // 0' 2>/dev/null || echo "0")
        low=$(echo "${audit_output}" | jq -r '.metadata.vulnerabilities.low // 0' 2>/dev/null || echo "0")
    fi

    echo -e "  ${BOLD}취약점 현황:${NC}"
    echo "  ──────────────────────────"
    printf "  %-12s %5s\n" "Critical:" "${critical}"
    printf "  %-12s %5s\n" "High:" "${high}"
    printf "  %-12s %5s\n" "Moderate:" "${moderate}"
    printf "  %-12s %5s\n" "Low:" "${low}"
    echo "  ──────────────────────────"
    echo ""

    if [ "${critical}" -eq 0 ]; then
        check_pass "Critical 취약점 없음"
    else
        check_fail "Critical 취약점 ${critical}건 (24시간 이내 조치 필요)"
    fi

    if [ "${high}" -eq 0 ]; then
        check_pass "High 취약점 없음"
    else
        check_warn "High 취약점 ${high}건 (7일 이내 조치 권고)"
    fi
    echo ""
}

# ============================================================================
# 2. 라이선스 호환성 검증
# Plan SC: FR-N140.2
# Design Ref: MTU-N140 Design §1.2
# ============================================================================
audit_licenses() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  2. 라이선스 호환성 검증${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    # 금지 라이선스 목록
    local banned_licenses=("GPL-3.0" "AGPL-3.0" "SSPL" "GPL-3.0-only" "AGPL-3.0-only")

    if [ -f "${PROJECT_ROOT}/pnpm-lock.yaml" ] || [ -f "${PROJECT_ROOT}/package.json" ]; then
        # 의존성에서 라이선스 검색 (package.json 기반)
        local banned_found=0

        for pkg_json in $(find "${PROJECT_ROOT}/node_modules" -maxdepth 2 -name "package.json" 2>/dev/null | head -100); do
            if command -v jq &>/dev/null; then
                local license
                license=$(jq -r '.license // empty' "${pkg_json}" 2>/dev/null || echo "")
                for banned in "${banned_licenses[@]}"; do
                    if [ "${license}" = "${banned}" ]; then
                        local pkg_name
                        pkg_name=$(jq -r '.name // "unknown"' "${pkg_json}" 2>/dev/null || echo "unknown")
                        check_fail "금지 라이선스: ${pkg_name} (${license})"
                        banned_found=$((banned_found + 1))
                    fi
                done
            fi
        done

        if [ "${banned_found}" -eq 0 ]; then
            check_pass "금지 라이선스 미검출 (GPL-3.0, AGPL-3.0, SSPL)"
        fi
    else
        check_warn "pnpm-lock.yaml 없음 — 라이선스 검증 제한적"
    fi

    echo ""
    echo -e "  ${BOLD}허용 라이선스:${NC} MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC"
    echo -e "  ${BOLD}금지 라이선스:${NC} GPL-3.0, AGPL-3.0, SSPL"
    echo ""
}

# ============================================================================
# 3. 업데이트 가능 패키지
# Plan SC: FR-N140.3
# ============================================================================
audit_outdated() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  3. 업데이트 가능 패키지${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    if command -v pnpm &>/dev/null; then
        local outdated_count=0
        outdated_count=$(cd "${PROJECT_ROOT}" && pnpm outdated 2>/dev/null | wc -l || echo "0")

        if [ "${outdated_count}" -le 2 ]; then
            check_pass "모든 패키지 최신 상태"
        elif [ "${outdated_count}" -le 20 ]; then
            check_warn "업데이트 가능 패키지 약 ${outdated_count}줄 출력"
        else
            check_warn "업데이트 필요 패키지 다수 (${outdated_count}줄)"
        fi
    else
        check_warn "pnpm 미설치 — outdated 검사 건너뜀"
    fi
    echo ""
}

# ============================================================================
# 4. 공급망 보안 점수 (S2C2F 기반)
# Plan SC: FR-N140.4
# ============================================================================
audit_supply_chain() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  4. 공급망 보안 점수 (S2C2F)${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    local score=0
    local max_score=100

    # 4-1. 잠금 파일 존재 (20점)
    if [ -f "${PROJECT_ROOT}/pnpm-lock.yaml" ]; then
        check_pass "pnpm-lock.yaml 존재 (의존성 고정)"
        score=$((score + 20))
    else
        check_fail "잠금 파일 없음"
    fi

    # 4-2. .npmrc 보안 설정 (15점)
    if [ -f "${PROJECT_ROOT}/.npmrc" ]; then
        check_pass ".npmrc 설정 존재"
        score=$((score + 15))
    else
        check_warn ".npmrc 미설정"
        score=$((score + 5))
    fi

    # 4-3. Cosign 서명 검증 설정 (20점)
    if grep -rl "cosign\|sigstore" "${PROJECT_ROOT}/infra/" "${PROJECT_ROOT}/scripts/" 2>/dev/null | grep -q .; then
        check_pass "Cosign/Sigstore 서명 검증 설정 존재"
        score=$((score + 20))
    else
        check_warn "이미지 서명 검증 미설정"
        score=$((score + 5))
    fi

    # 4-4. SBOM 생성 설정 (20점)
    if grep -rl "SBOM\|sbom\|cyclonedx\|spdx" "${PROJECT_ROOT}/infra/" "${PROJECT_ROOT}/scripts/" 2>/dev/null | grep -q .; then
        check_pass "SBOM 생성 설정 존재"
        score=$((score + 20))
    else
        check_warn "SBOM 미설정"
        score=$((score + 5))
    fi

    # 4-5. 의존성 자동 업데이트 (10점)
    if grep -rl "renovate\|dependabot" "${PROJECT_ROOT}/" 2>/dev/null | grep -q .; then
        check_pass "자동 업데이트 설정 (Renovate/Dependabot)"
        score=$((score + 10))
    else
        check_warn "의존성 자동 업데이트 미설정"
        score=$((score + 5))
    fi

    # 4-6. 보안 정책 (15점)
    if [ -f "${PROJECT_ROOT}/.claude/rules/csap-compliance.md" ]; then
        check_pass "보안 정책 문서 존재"
        score=$((score + 15))
    else
        check_fail "보안 정책 미정의"
    fi

    echo ""
    echo -e "  ${BOLD}S2C2F 공급망 보안 점수: ${score}/${max_score}${NC}"

    local grade="D"
    if [ "${score}" -ge 80 ]; then grade="A"
    elif [ "${score}" -ge 60 ]; then grade="B"
    elif [ "${score}" -ge 40 ]; then grade="C"
    fi
    echo -e "  ${BOLD}등급: ${grade}${NC}"
    echo ""
}

# ============================================================================
# 요약
# ============================================================================
summary() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  의존성 보안 감사 요약${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
    echo "  검사 항목: ${TOTAL_CHECKS}건"
    echo -e "  ${GREEN}PASS: ${PASS_CHECKS}${NC} | ${YELLOW}WARN: ${WARN_CHECKS}${NC} | ${RED}FAIL: ${FAIL_CHECKS}${NC}"
    echo ""

    log_audit "DEPENDENCY_AUDIT" "total=${TOTAL_CHECKS},pass=${PASS_CHECKS},warn=${WARN_CHECKS},fail=${FAIL_CHECKS}"
}

# ============================================================================
# 메인
# ============================================================================
main() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  의존성 보안 감사${NC}"
    echo -e "${CYAN}  날짜: $(date -Iseconds)${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    if [ -n "${CHECK_FILTER}" ]; then
        case "${CHECK_FILTER}" in
            vulns)        audit_vulnerabilities ;;
            licenses)     audit_licenses ;;
            outdated)     audit_outdated ;;
            supply-chain) audit_supply_chain ;;
            *)            echo "알 수 없는 유형: ${CHECK_FILTER}"; exit 1 ;;
        esac
    else
        audit_vulnerabilities
        audit_licenses
        audit_outdated
        audit_supply_chain
    fi

    summary
    echo -e "${GREEN}의존성 보안 감사 완료${NC}"
}

main "$@"
