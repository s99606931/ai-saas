#!/bin/bash
# ============================================================================
# 환경별 구성 관리 감사 — dev/stg/prod 구성 차이 + 드리프트 감지
# Plan SC: FR-N138.1, FR-N138.2, FR-N138.3, FR-N138.4
# Design Ref: MTU-N138 Design §1
# CSAP: D-12 (시스템 개발 보안 — 구성 관리)
#
# 사용법:
#   ./scripts/env-config-audit.sh                  # 전체 감사
#   ./scripts/env-config-audit.sh --env prod       # 특정 환경
#   ./scripts/env-config-audit.sh --check secrets  # 시크릿 검증만
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
AUDIT_LOG="${PROJECT_ROOT}/.claude/audit.jsonl"
ENV_FILTER=""
CHECK_FILTER=""
ENVIRONMENTS=("dev" "stg" "prod")

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
        --env) ENV_FILTER="$2"; shift 2 ;;
        --check) CHECK_FILTER="$2"; shift 2 ;;
        --help)
            echo "사용법: env-config-audit.sh [옵션]"
            echo "  --env ENV       특정 환경 (dev|stg|prod)"
            echo "  --check TYPE    검증 유형 (secrets|resources|images|replicas)"
            exit 0 ;;
        *) shift ;;
    esac
done

log_audit() {
    local entry="{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"actor\":\"env-config-audit\",\"action\":\"$1\",\"detail\":\"$2\"}"
    echo "${entry}" >> "${AUDIT_LOG}" 2>/dev/null || true
}

check_pass() { TOTAL_CHECKS=$((TOTAL_CHECKS+1)); PASS_CHECKS=$((PASS_CHECKS+1)); echo -e "  ${GREEN}[PASS]${NC} $1"; }
check_warn() { TOTAL_CHECKS=$((TOTAL_CHECKS+1)); WARN_CHECKS=$((WARN_CHECKS+1)); echo -e "  ${YELLOW}[WARN]${NC} $1"; }
check_fail() { TOTAL_CHECKS=$((TOTAL_CHECKS+1)); FAIL_CHECKS=$((FAIL_CHECKS+1)); echo -e "  ${RED}[FAIL]${NC} $1"; }

# ============================================================================
# 1. 환경별 구성 목록화
# Plan SC: FR-N138.1
# ============================================================================
audit_config_files() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  1. 환경별 구성 파일 목록${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    for env in "${ENVIRONMENTS[@]}"; do
        if [ -n "${ENV_FILTER}" ] && [ "${env}" != "${ENV_FILTER}" ]; then
            continue
        fi

        echo -e "  ${BOLD}[${env}] 환경:${NC}"

        # 환경별 디렉토리 탐색
        local env_dirs=0
        env_dirs=$(find "${PROJECT_ROOT}/infra" -type d -name "${env}" 2>/dev/null | wc -l || echo "0")

        # 환경별 설정 파일
        local env_files=0
        env_files=$(find "${PROJECT_ROOT}" -name "*${env}*" \
            -not -path "*/node_modules/*" -not -path "*/.git/*" \
            \( -name "*.yaml" -o -name "*.yml" -o -name "*.json" -o -name "*.env*" \) \
            2>/dev/null | wc -l || echo "0")

        # Helm values 파일
        local helm_values=0
        helm_values=$(find "${PROJECT_ROOT}/infra" -name "values-${env}.yaml" -o -name "values.${env}.yaml" \
            2>/dev/null | wc -l || echo "0")

        echo "    - 환경 디렉토리: ${env_dirs}개"
        echo "    - 구성 파일: ${env_files}개"
        echo "    - Helm values: ${helm_values}개"

        if [ "${env_files}" -gt 0 ]; then
            check_pass "${env} 환경 구성 파일 존재 (${env_files}개)"
        else
            check_warn "${env} 환경 전용 구성 파일 없음"
        fi
        echo ""
    done
}

# ============================================================================
# 2. 시크릿 분리 검증
# Plan SC: FR-N138.3
# ============================================================================
audit_secrets() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  2. 시크릿 관리 검증${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    # .env 파일이 git에 포함되지 않는지 확인
    if [ -f "${PROJECT_ROOT}/.gitignore" ]; then
        if grep -q "\.env" "${PROJECT_ROOT}/.gitignore"; then
            check_pass ".gitignore에 .env 패턴 포함"
        else
            check_fail ".gitignore에 .env 패턴 없음"
        fi
    else
        check_fail ".gitignore 파일 없음"
    fi

    # 하드코딩된 시크릿 검출
    local hardcoded=0
    hardcoded=$(grep -rn \
        -e 'password\s*[:=]\s*["\x27][^$"'\'']\{8,\}' \
        -e 'secret\s*[:=]\s*["\x27][^$"'\'']\{8,\}' \
        --include="*.yaml" --include="*.yml" \
        "${PROJECT_ROOT}/infra/" 2>/dev/null | \
        grep -v "example\|template\|placeholder\|changeme\|TODO" | wc -l || echo "0")

    if [ "${hardcoded}" -eq 0 ]; then
        check_pass "인프라 설정에 하드코딩 시크릿 미검출"
    else
        check_fail "인프라 설정에 하드코딩 시크릿 ${hardcoded}건 의심"
    fi

    # ExternalSecret/SealedSecret 사용 확인
    local external_secret=0
    external_secret=$(grep -rl "ExternalSecret\|SealedSecret\|SecretStore" \
        "${PROJECT_ROOT}/infra/" 2>/dev/null | wc -l || echo "0")
    if [ "${external_secret}" -gt 0 ]; then
        check_pass "외부 시크릿 관리 (ExternalSecret/SealedSecret) ${external_secret}개"
    else
        check_warn "외부 시크릿 관리 미설정 (환경 변수 또는 Kubernetes Secret 직접 사용)"
    fi
    echo ""
}

# ============================================================================
# 3. 리소스 제한 일관성
# ============================================================================
audit_resources() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  3. 리소스 제한 일관성${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    # ResourceQuota 파일 존재 확인
    local quota_files=0
    quota_files=$(grep -rl "ResourceQuota" "${PROJECT_ROOT}/infra/" 2>/dev/null | wc -l || echo "0")
    if [ "${quota_files}" -gt 0 ]; then
        check_pass "ResourceQuota 정의: ${quota_files}개 파일"
    else
        check_warn "ResourceQuota 미정의"
    fi

    # LimitRange 파일 존재 확인
    local limitrange_files=0
    limitrange_files=$(grep -rl "LimitRange" "${PROJECT_ROOT}/infra/" 2>/dev/null | wc -l || echo "0")
    if [ "${limitrange_files}" -gt 0 ]; then
        check_pass "LimitRange 정의: ${limitrange_files}개 파일"
    else
        check_warn "LimitRange 미정의"
    fi

    # resources.limits 포함 비율
    local total_deployments=0
    total_deployments=$(grep -rl "kind: Deployment\|kind: StatefulSet" "${PROJECT_ROOT}/infra/" 2>/dev/null | wc -l || echo "0")
    local with_limits=0
    with_limits=$(grep -rl "limits:" "${PROJECT_ROOT}/infra/" 2>/dev/null | wc -l || echo "0")

    if [ "${total_deployments}" -gt 0 ]; then
        local ratio=$((with_limits * 100 / (total_deployments > 0 ? total_deployments : 1)))
        if [ "${ratio}" -ge 80 ]; then
            check_pass "리소스 제한 설정률: ${ratio}% (${with_limits}/${total_deployments})"
        else
            check_warn "리소스 제한 설정률: ${ratio}% (80% 미만)"
        fi
    fi
    echo ""
}

# ============================================================================
# 4. 이미지 태그 정책
# ============================================================================
audit_images() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  4. 이미지 태그 정책${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    # latest 태그 사용 검출
    local latest_count=0
    latest_count=$(grep -rn "image:.*:latest" "${PROJECT_ROOT}/infra/" 2>/dev/null | \
        grep -v "example\|template\|comment" | wc -l || echo "0")

    if [ "${latest_count}" -eq 0 ]; then
        check_pass "latest 태그 미사용"
    else
        check_warn "latest 태그 ${latest_count}건 사용 (prod 환경 금지)"
    fi

    # 이미지 digest 사용 확인
    local digest_count=0
    digest_count=$(grep -rn "image:.*@sha256:" "${PROJECT_ROOT}/infra/" 2>/dev/null | wc -l || echo "0")
    if [ "${digest_count}" -gt 0 ]; then
        check_pass "이미지 digest 고정: ${digest_count}건 (불변 배포)"
    else
        check_warn "이미지 digest 미사용 (태그 기반)"
    fi
    echo ""
}

# ============================================================================
# 요약
# ============================================================================
summary() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  환경 구성 감사 요약${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
    echo "  검사 항목: ${TOTAL_CHECKS}건"
    echo -e "  ${GREEN}PASS: ${PASS_CHECKS}${NC} | ${YELLOW}WARN: ${WARN_CHECKS}${NC} | ${RED}FAIL: ${FAIL_CHECKS}${NC}"
    echo ""

    if [ "${FAIL_CHECKS}" -eq 0 ]; then
        echo -e "  ${GREEN}${BOLD}결과: 환경 구성 감사 통과${NC}"
    else
        echo -e "  ${RED}${BOLD}결과: ${FAIL_CHECKS}건 실패 — 조치 필요${NC}"
    fi

    log_audit "ENV_CONFIG_AUDIT" "total=${TOTAL_CHECKS},pass=${PASS_CHECKS},warn=${WARN_CHECKS},fail=${FAIL_CHECKS}"
}

# ============================================================================
# 메인
# ============================================================================
main() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  환경별 구성 관리 감사${NC}"
    echo -e "${CYAN}  날짜: $(date -Iseconds)${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    if [ -n "${CHECK_FILTER}" ]; then
        case "${CHECK_FILTER}" in
            secrets)   audit_secrets ;;
            resources) audit_resources ;;
            images)    audit_images ;;
            *)         echo "알 수 없는 유형: ${CHECK_FILTER}"; exit 1 ;;
        esac
    else
        audit_config_files
        audit_secrets
        audit_resources
        audit_images
    fi

    summary
}

main "$@"
