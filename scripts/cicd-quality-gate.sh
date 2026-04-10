#!/bin/bash
# ============================================================================
# CI/CD 통합 품질 게이트
# Plan SC: FR-N133.1, FR-N133.2, FR-N133.3
# Design Ref: MTU-N133 Design §1, §2
# CSAP: D-12 시스템 개발 보안
#
# 사용법:
#   ./scripts/cicd-quality-gate.sh                    # 전체 게이트
#   ./scripts/cicd-quality-gate.sh --area security    # 보안 영역만
#   ./scripts/cicd-quality-gate.sh --threshold 90     # 합격 기준 변경
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
AUDIT_LOG="${PROJECT_ROOT}/.claude/audit.jsonl"

# 기본 설정
THRESHOLD_TOTAL=80
THRESHOLD_SECURITY=70
THRESHOLD_AREA=50
AREA_FILTER=""

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# 점수 변수
SECURITY_SCORE=0
TEST_SCORE=0
CODE_SCORE=0
COMPLIANCE_SCORE=0
TOTAL_SCORE=0

# ============================================================================
# 인수 파싱
# ============================================================================
while [[ $# -gt 0 ]]; do
    case "$1" in
        --area) AREA_FILTER="$2"; shift 2 ;;
        --threshold) THRESHOLD_TOTAL="$2"; shift 2 ;;
        --help)
            echo "사용법: cicd-quality-gate.sh [옵션]"
            echo "  --area AREA       특정 영역만 (security|test|code|compliance)"
            echo "  --threshold N     전체 합격 기준 (기본: 80)"
            exit 0 ;;
        *) shift ;;
    esac
done

# ============================================================================
# 감사 로그 기록
# ============================================================================
log_audit() {
    local action="$1"
    local detail="$2"
    local entry="{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"actor\":\"cicd-quality-gate\",\"action\":\"${action}\",\"detail\":\"${detail}\"}"
    echo "${entry}" >> "${AUDIT_LOG}" 2>/dev/null || true
}

# ============================================================================
# 1. 보안 영역 (100점 만점, 가중치 30%)
# Design Ref: MTU-N133 Design §1.3 보안
# ============================================================================
assess_security() {
    echo -e "${CYAN}[1/4] 보안 영역 평가 (가중치: 30%)${NC}"
    echo "────────────────────────────────────"
    local score=0

    # 1-1. 시크릿 검출 (25점)
    local secret_count=0
    secret_count=$(grep -rn \
        -e 'sk-[a-zA-Z0-9]\{20,\}' \
        -e 'AKIA[0-9A-Z]\{16\}' \
        -e 'password\s*=\s*["\x27][^"'\'']\{8,\}["\x27]' \
        --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" \
        "${PROJECT_ROOT}/platform/" 2>/dev/null | \
        grep -v node_modules | grep -v '.test.' | grep -v 'test-' | wc -l || echo "0")
    if [ "${secret_count}" -eq 0 ]; then
        echo -e "  ${GREEN}[25/25]${NC} 시크릿 미검출"
        score=$((score + 25))
    else
        echo -e "  ${RED}[ 0/25]${NC} 시크릿 ${secret_count}건 검출"
    fi

    # 1-2. SQL 인젝션 패턴 (20점)
    local sqli_count=0
    sqli_count=$(grep -rn \
        -e 'query.*\$\{' \
        -e "execute.*\`.*\$\{" \
        --include="*.ts" --include="*.js" \
        "${PROJECT_ROOT}/platform/" 2>/dev/null | \
        grep -v node_modules | grep -v '.test.' | grep -v '.spec.' | wc -l || echo "0")
    if [ "${sqli_count}" -eq 0 ]; then
        echo -e "  ${GREEN}[20/20]${NC} SQL 인젝션 패턴 미검출"
        score=$((score + 20))
    else
        echo -e "  ${RED}[ 0/20]${NC} SQL 인젝션 의심 패턴 ${sqli_count}건"
    fi

    # 1-3. 하드코딩 API 키 (20점)
    local apikey_count=0
    apikey_count=$(grep -rn \
        -e 'apiKey\s*[:=]\s*["\x27][a-zA-Z0-9]\{16,\}' \
        -e 'api_key\s*[:=]\s*["\x27][a-zA-Z0-9]\{16,\}' \
        --include="*.ts" --include="*.js" --include="*.tsx" \
        "${PROJECT_ROOT}/platform/" 2>/dev/null | \
        grep -v node_modules | grep -v '.test.' | grep -v 'process.env' | wc -l || echo "0")
    if [ "${apikey_count}" -eq 0 ]; then
        echo -e "  ${GREEN}[20/20]${NC} 하드코딩 API 키 미검출"
        score=$((score + 20))
    else
        echo -e "  ${RED}[ 0/20]${NC} 하드코딩 API 키 ${apikey_count}건"
    fi

    # 1-4. RBAC 검사 존재 (20점)
    local rbac_files=0
    rbac_files=$(grep -rl \
        -e 'hasPermission\|verifyToken\|requireAuth\|@UseGuards\|rbac' \
        --include="*.ts" --include="*.js" \
        "${PROJECT_ROOT}/platform/" 2>/dev/null | \
        grep -v node_modules | wc -l || echo "0")
    if [ "${rbac_files}" -ge 3 ]; then
        echo -e "  ${GREEN}[20/20]${NC} RBAC 검사 ${rbac_files}개 파일에서 발견"
        score=$((score + 20))
    elif [ "${rbac_files}" -ge 1 ]; then
        echo -e "  ${YELLOW}[10/20]${NC} RBAC 검사 부분적 (${rbac_files}개 파일)"
        score=$((score + 10))
    else
        echo -e "  ${RED}[ 0/20]${NC} RBAC 검사 미발견"
    fi

    # 1-5. XSS 새니타이징 (15점)
    local sanitize_count=0
    sanitize_count=$(grep -rl \
        -e 'DOMPurify\|sanitize\|escapeHtml\|xss' \
        --include="*.ts" --include="*.tsx" --include="*.js" \
        "${PROJECT_ROOT}/platform/" 2>/dev/null | \
        grep -v node_modules | wc -l || echo "0")
    if [ "${sanitize_count}" -ge 1 ]; then
        echo -e "  ${GREEN}[15/15]${NC} XSS 새니타이징 ${sanitize_count}개 파일"
        score=$((score + 15))
    else
        echo -e "  ${YELLOW}[ 5/15]${NC} XSS 새니타이징 미확인 (프레임워크 내장 가능)"
        score=$((score + 5))
    fi

    SECURITY_SCORE=${score}
    echo -e "  ${BOLD}보안 점수: ${score}/100${NC}"
    echo ""
}

# ============================================================================
# 2. 테스트 영역 (100점 만점, 가중치 25%)
# Design Ref: MTU-N133 Design §1.3 테스트
# ============================================================================
assess_test() {
    echo -e "${CYAN}[2/4] 테스트 영역 평가 (가중치: 25%)${NC}"
    echo "────────────────────────────────────"
    local score=0

    # 2-1. 테스트 파일 존재 (40점)
    local test_files=0
    test_files=$(find "${PROJECT_ROOT}/platform" -name "*.test.ts" -o -name "*.spec.ts" \
        -o -name "*.test.js" -o -name "*.spec.js" 2>/dev/null | \
        grep -v node_modules | wc -l || echo "0")
    if [ "${test_files}" -ge 10 ]; then
        echo -e "  ${GREEN}[40/40]${NC} 테스트 파일 ${test_files}개 발견"
        score=$((score + 40))
    elif [ "${test_files}" -ge 5 ]; then
        echo -e "  ${YELLOW}[25/40]${NC} 테스트 파일 ${test_files}개 (10개 미만)"
        score=$((score + 25))
    elif [ "${test_files}" -ge 1 ]; then
        echo -e "  ${YELLOW}[15/40]${NC} 테스트 파일 ${test_files}개 (5개 미만)"
        score=$((score + 15))
    else
        echo -e "  ${RED}[ 0/40]${NC} 테스트 파일 없음"
    fi

    # 2-2. 커버리지 설정 존재 (30점)
    local coverage_config=0
    if grep -rq "coverage\|coverageThreshold\|c8\|istanbul\|nyc" \
        "${PROJECT_ROOT}/platform/package.json" \
        "${PROJECT_ROOT}/package.json" 2>/dev/null; then
        coverage_config=1
    fi
    if find "${PROJECT_ROOT}" -maxdepth 3 -name ".nycrc*" -o -name "jest.config.*" \
        -o -name "vitest.config.*" 2>/dev/null | grep -q .; then
        coverage_config=1
    fi
    if [ "${coverage_config}" -eq 1 ]; then
        echo -e "  ${GREEN}[30/30]${NC} 커버리지 설정 존재"
        score=$((score + 30))
    else
        echo -e "  ${YELLOW}[10/30]${NC} 커버리지 설정 미확인"
        score=$((score + 10))
    fi

    # 2-3. E2E 테스트 존재 (30점)
    local e2e_files=0
    e2e_files=$(find "${PROJECT_ROOT}/platform" -path "*/e2e*" -name "*.ts" 2>/dev/null | \
        grep -v node_modules | wc -l || echo "0")
    if [ "${e2e_files}" -ge 3 ]; then
        echo -e "  ${GREEN}[30/30]${NC} E2E 테스트 ${e2e_files}개 파일"
        score=$((score + 30))
    elif [ "${e2e_files}" -ge 1 ]; then
        echo -e "  ${YELLOW}[15/30]${NC} E2E 테스트 ${e2e_files}개 (3개 미만)"
        score=$((score + 15))
    else
        echo -e "  ${RED}[ 0/30]${NC} E2E 테스트 없음"
    fi

    TEST_SCORE=${score}
    echo -e "  ${BOLD}테스트 점수: ${score}/100${NC}"
    echo ""
}

# ============================================================================
# 3. 코드 품질 영역 (100점 만점, 가중치 25%)
# Design Ref: MTU-N133 Design §1.3 코드 품질
# ============================================================================
assess_code_quality() {
    echo -e "${CYAN}[3/4] 코드 품질 영역 평가 (가중치: 25%)${NC}"
    echo "────────────────────────────────────"
    local score=0

    # 3-1. Lint 설정 존재 (30점)
    if [ -f "${PROJECT_ROOT}/.eslintrc.json" ] || [ -f "${PROJECT_ROOT}/.eslintrc.js" ] || \
       [ -f "${PROJECT_ROOT}/eslint.config.js" ] || [ -f "${PROJECT_ROOT}/eslint.config.mjs" ] || \
       grep -q "eslint" "${PROJECT_ROOT}/package.json" 2>/dev/null; then
        echo -e "  ${GREEN}[30/30]${NC} ESLint 설정 존재"
        score=$((score + 30))
    else
        echo -e "  ${RED}[ 0/30]${NC} ESLint 설정 미발견"
    fi

    # 3-2. TypeScript 설정 존재 (30점)
    if [ -f "${PROJECT_ROOT}/tsconfig.json" ] || \
       find "${PROJECT_ROOT}" -maxdepth 2 -name "tsconfig*.json" 2>/dev/null | grep -q .; then
        echo -e "  ${GREEN}[30/30]${NC} TypeScript 설정 존재"
        score=$((score + 30))
    else
        echo -e "  ${RED}[ 0/30]${NC} TypeScript 설정 미발견"
    fi

    # 3-3. 과대 파일 검출 (20점)
    local large_files=0
    large_files=$(find "${PROJECT_ROOT}/platform" -name "*.ts" -o -name "*.tsx" \
        -o -name "*.js" -o -name "*.jsx" 2>/dev/null | \
        grep -v node_modules | grep -v dist | \
        xargs wc -l 2>/dev/null | \
        awk '$1 > 800 && !/total/' | wc -l || echo "0")
    if [ "${large_files}" -eq 0 ]; then
        echo -e "  ${GREEN}[20/20]${NC} 800줄 초과 파일 없음"
        score=$((score + 20))
    elif [ "${large_files}" -le 3 ]; then
        echo -e "  ${YELLOW}[10/20]${NC} 800줄 초과 ${large_files}개 파일"
        score=$((score + 10))
    else
        echo -e "  ${RED}[ 0/20]${NC} 800줄 초과 ${large_files}개 파일"
    fi

    # 3-4. Dead code 정책 (20점)
    if [ -f "${PROJECT_ROOT}/.claude/rules/deadcode-policy.md" ]; then
        echo -e "  ${GREEN}[20/20]${NC} Dead code 정책 문서 존재"
        score=$((score + 20))
    else
        echo -e "  ${RED}[ 0/20]${NC} Dead code 정책 미발견"
    fi

    CODE_SCORE=${score}
    echo -e "  ${BOLD}코드 품질 점수: ${score}/100${NC}"
    echo ""
}

# ============================================================================
# 4. 규정 준수 영역 (100점 만점, 가중치 20%)
# Design Ref: MTU-N133 Design §1.3 규정 준수
# ============================================================================
assess_compliance() {
    echo -e "${CYAN}[4/4] 규정 준수 영역 평가 (가중치: 20%)${NC}"
    echo "────────────────────────────────────"
    local score=0

    # 4-1. Plan 문서 존재 (20점)
    local plan_count=0
    plan_count=$(find "${PROJECT_ROOT}/docs/01-plan/mtus" -name "*.plan.md" 2>/dev/null | wc -l || echo "0")
    if [ "${plan_count}" -ge 10 ]; then
        echo -e "  ${GREEN}[20/20]${NC} Plan 문서 ${plan_count}개"
        score=$((score + 20))
    elif [ "${plan_count}" -ge 1 ]; then
        echo -e "  ${YELLOW}[10/20]${NC} Plan 문서 ${plan_count}개 (10개 미만)"
        score=$((score + 10))
    else
        echo -e "  ${RED}[ 0/20]${NC} Plan 문서 없음"
    fi

    # 4-2. Design 문서 존재 (20점)
    local design_count=0
    design_count=$(find "${PROJECT_ROOT}/docs/02-design/mtus" -name "*.design.md" 2>/dev/null | wc -l || echo "0")
    if [ "${design_count}" -ge 10 ]; then
        echo -e "  ${GREEN}[20/20]${NC} Design 문서 ${design_count}개"
        score=$((score + 20))
    elif [ "${design_count}" -ge 1 ]; then
        echo -e "  ${YELLOW}[10/20]${NC} Design 문서 ${design_count}개 (10개 미만)"
        score=$((score + 10))
    else
        echo -e "  ${RED}[ 0/20]${NC} Design 문서 없음"
    fi

    # 4-3. Q-Gate 스크립트 존재 (30점)
    if [ -f "${PROJECT_ROOT}/scripts/qgate-verify.sh" ]; then
        echo -e "  ${GREEN}[30/30]${NC} Q-Gate 검증 스크립트 존재"
        score=$((score + 30))
    else
        echo -e "  ${RED}[ 0/30]${NC} Q-Gate 스크립트 미발견"
    fi

    # 4-4. 감사 로그 존재 (15점)
    if [ -f "${AUDIT_LOG}" ]; then
        local audit_lines=0
        audit_lines=$(wc -l < "${AUDIT_LOG}" 2>/dev/null || echo "0")
        echo -e "  ${GREEN}[15/15]${NC} 감사 로그 ${audit_lines}줄"
        score=$((score + 15))
    else
        echo -e "  ${RED}[ 0/15]${NC} 감사 로그 없음"
    fi

    # 4-5. CSAP 매핑 존재 (15점)
    if [ -f "${PROJECT_ROOT}/.claude/rules/csap-compliance.md" ]; then
        echo -e "  ${GREEN}[15/15]${NC} CSAP 준수 규칙 존재"
        score=$((score + 15))
    else
        echo -e "  ${RED}[ 0/15]${NC} CSAP 규칙 미발견"
    fi

    COMPLIANCE_SCORE=${score}
    echo -e "  ${BOLD}규정 준수 점수: ${score}/100${NC}"
    echo ""
}

# ============================================================================
# 통합 점수 산출 및 판정
# Design Ref: MTU-N133 Design §1.2
# ============================================================================
calculate_total() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  CI/CD 통합 품질 게이트 결과${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    # 가중 합산 -- Design Ref: §1.2
    local weighted_security=$((SECURITY_SCORE * 30 / 100))
    local weighted_test=$((TEST_SCORE * 25 / 100))
    local weighted_code=$((CODE_SCORE * 25 / 100))
    local weighted_compliance=$((COMPLIANCE_SCORE * 20 / 100))
    TOTAL_SCORE=$((weighted_security + weighted_test + weighted_code + weighted_compliance))

    echo -e "  ${BOLD}영역별 점수${NC}"
    echo "  ────────────────────────────────────"
    printf "  보안:       %3d/100 (가중: %2d점, 30%%)\n" "${SECURITY_SCORE}" "${weighted_security}"
    printf "  테스트:     %3d/100 (가중: %2d점, 25%%)\n" "${TEST_SCORE}" "${weighted_test}"
    printf "  코드 품질:  %3d/100 (가중: %2d점, 25%%)\n" "${CODE_SCORE}" "${weighted_code}"
    printf "  규정 준수:  %3d/100 (가중: %2d점, 20%%)\n" "${COMPLIANCE_SCORE}" "${weighted_compliance}"
    echo "  ────────────────────────────────────"
    printf "  ${BOLD}전체 점수:   %3d/100${NC}\n" "${TOTAL_SCORE}"
    echo ""

    # 합격 판정 -- Design Ref: §1.1
    local gate_pass=true
    local fail_reasons=""

    if [ "${TOTAL_SCORE}" -lt "${THRESHOLD_TOTAL}" ]; then
        gate_pass=false
        fail_reasons="${fail_reasons}\n  - 전체 점수 ${TOTAL_SCORE} < 기준 ${THRESHOLD_TOTAL}"
    fi
    if [ "${SECURITY_SCORE}" -lt "${THRESHOLD_SECURITY}" ]; then
        gate_pass=false
        fail_reasons="${fail_reasons}\n  - 보안 점수 ${SECURITY_SCORE} < 기준 ${THRESHOLD_SECURITY}"
    fi
    if [ "${TEST_SCORE}" -lt "${THRESHOLD_AREA}" ]; then
        gate_pass=false
        fail_reasons="${fail_reasons}\n  - 테스트 점수 ${TEST_SCORE} < 기준 ${THRESHOLD_AREA}"
    fi
    if [ "${CODE_SCORE}" -lt "${THRESHOLD_AREA}" ]; then
        gate_pass=false
        fail_reasons="${fail_reasons}\n  - 코드 품질 점수 ${CODE_SCORE} < 기준 ${THRESHOLD_AREA}"
    fi
    if [ "${COMPLIANCE_SCORE}" -lt "${THRESHOLD_AREA}" ]; then
        gate_pass=false
        fail_reasons="${fail_reasons}\n  - 규정 준수 점수 ${COMPLIANCE_SCORE} < 기준 ${THRESHOLD_AREA}"
    fi

    echo "  합격 기준:"
    echo "  - 전체 >= ${THRESHOLD_TOTAL}점"
    echo "  - 보안 >= ${THRESHOLD_SECURITY}점"
    echo "  - 각 영역 >= ${THRESHOLD_AREA}점"
    echo ""

    if [ "${gate_pass}" = true ]; then
        echo -e "  ${GREEN}${BOLD}결과: GATE PASS${NC}"
        log_audit "QUALITY_GATE_PASS" "total=${TOTAL_SCORE},security=${SECURITY_SCORE},test=${TEST_SCORE},code=${CODE_SCORE},compliance=${COMPLIANCE_SCORE}"
        return 0
    else
        echo -e "  ${RED}${BOLD}결과: GATE FAIL${NC}"
        echo -e "  불합격 사유:${fail_reasons}"
        log_audit "QUALITY_GATE_FAIL" "total=${TOTAL_SCORE},security=${SECURITY_SCORE},test=${TEST_SCORE},code=${CODE_SCORE},compliance=${COMPLIANCE_SCORE}"
        return 1
    fi
}

# ============================================================================
# 메인 실행
# ============================================================================
main() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  CI/CD 통합 품질 게이트${NC}"
    echo -e "${CYAN}  날짜: $(date -Iseconds)${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    if [ -n "${AREA_FILTER}" ]; then
        case "${AREA_FILTER}" in
            security)   assess_security ;;
            test)       assess_test ;;
            code)       assess_code_quality ;;
            compliance) assess_compliance ;;
            *)          echo "알 수 없는 영역: ${AREA_FILTER}"; exit 1 ;;
        esac
    else
        assess_security
        assess_test
        assess_code_quality
        assess_compliance
    fi

    calculate_total
}

main "$@"
