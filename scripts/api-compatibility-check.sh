#!/usr/bin/env bash
# Design Ref: MTU-N165 Section 2
# Plan SC: FR-N165.2
# CSAP: D-12 시스템 개발 보안
#
# OpenAPI 스키마 호환성 검사 스크립트
# 이전 버전과 현재 버전의 OpenAPI 스키마를 비교하여 파괴적 변경 감지

set -euo pipefail

readonly SCRIPT_NAME="api-compatibility-check"
readonly BASE_DIR="/data/ai-saas"
readonly SPEC_DIR="${BASE_DIR}/docs/api"
readonly LOG_FILE="/var/log/saas/${SCRIPT_NAME}.log"

log() {
  local level="$1"; shift
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [${level}] ${SCRIPT_NAME}: $*" | tee -a "${LOG_FILE}" 2>/dev/null || true
}

usage() {
  cat <<EOF
사용법: $0 [옵션]

OpenAPI 스키마 호환성 검사

옵션:
  --base FILE       기준 OpenAPI 스키마 (이전 버전)
  --target FILE     대상 OpenAPI 스키마 (현재 버전)
  --strict          파괴적 변경 시 비정상 종료 (CI용)
  --report FILE     호환성 보고서 출력 파일
  --help            도움말

예시:
  $0 --base api-v1.yaml --target api-v1-new.yaml --strict
  $0 --base api-v1.yaml --target api-v2.yaml --report report.md
EOF
}

PASS=0
FAIL=0
WARN=0
BREAKING=0

check_pass() { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
check_fail() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); BREAKING=$((BREAKING + 1)); }
check_warn() { echo "  [WARN] $1"; WARN=$((WARN + 1)); }

# 엔드포인트 제거 검사
check_endpoint_removal() {
  local base="$1"
  local target="$2"

  echo ""
  echo "--- 엔드포인트 호환성 검사 ---"

  local base_paths target_paths
  base_paths=$(python3 -c "
import yaml, sys
with open('${base}') as f:
    spec = yaml.safe_load(f)
paths = spec.get('paths', {})
for p in sorted(paths.keys()):
    for method in sorted(paths[p].keys()):
        if method in ['get','post','put','delete','patch']:
            print(f'{method.upper()} {p}')
" 2>/dev/null || echo "")

  target_paths=$(python3 -c "
import yaml, sys
with open('${target}') as f:
    spec = yaml.safe_load(f)
paths = spec.get('paths', {})
for p in sorted(paths.keys()):
    for method in sorted(paths[p].keys()):
        if method in ['get','post','put','delete','patch']:
            print(f'{method.upper()} {p}')
" 2>/dev/null || echo "")

  if [[ -z "${base_paths}" || -z "${target_paths}" ]]; then
    check_warn "OpenAPI 스키마 파싱 실패 (파일 확인 필요)"
    return
  fi

  # 제거된 엔드포인트 검사
  while IFS= read -r endpoint; do
    if echo "${target_paths}" | grep -qF "${endpoint}"; then
      check_pass "엔드포인트 유지: ${endpoint}"
    else
      check_fail "엔드포인트 제거됨 (파괴적 변경): ${endpoint}"
    fi
  done <<< "${base_paths}"

  # 추가된 엔드포인트
  while IFS= read -r endpoint; do
    if ! echo "${base_paths}" | grep -qF "${endpoint}"; then
      check_pass "새 엔드포인트 추가 (하위호환): ${endpoint}"
    fi
  done <<< "${target_paths}"
}

generate_report() {
  local report_file="$1"

  cat > "${report_file}" <<EOF
# API 호환성 검사 보고서

> **검사 일시**: $(date -u +%Y-%m-%dT%H:%M:%SZ)
> **기준 스키마**: ${BASE_FILE:-N/A}
> **대상 스키마**: ${TARGET_FILE:-N/A}

## 결과 요약

| 항목 | 수 |
|------|---|
| PASS | ${PASS} |
| FAIL (파괴적 변경) | ${FAIL} |
| WARN | ${WARN} |

## 판정

$(if [[ ${BREAKING} -eq 0 ]]; then
  echo "**하위호환 유지**: 파괴적 변경이 발견되지 않았습니다."
else
  echo "**파괴적 변경 감지**: ${BREAKING}건의 파괴적 변경이 발견되었습니다. 메이저 버전 업이 필요합니다."
fi)
EOF

  log "INFO" "호환성 보고서 생성: ${report_file}"
}

main() {
  local base_file=""
  local target_file=""
  local strict="false"
  local report_file=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --base)    base_file="$2"; shift 2 ;;
      --target)  target_file="$2"; shift 2 ;;
      --strict)  strict="true"; shift ;;
      --report)  report_file="$2"; shift 2 ;;
      --help)    usage; exit 0 ;;
      *)         log "ERROR" "알 수 없는 옵션: $1"; usage; exit 1 ;;
    esac
  done

  mkdir -p "$(dirname "${LOG_FILE}")" 2>/dev/null || true

  echo "========================================"
  echo " API 호환성 검사"
  echo "========================================"

  if [[ -n "${base_file}" && -n "${target_file}" ]]; then
    BASE_FILE="${base_file}"
    TARGET_FILE="${target_file}"
    check_endpoint_removal "${base_file}" "${target_file}"
  else
    echo ""
    echo "  스키마 파일 미지정. --base / --target 옵션을 사용하십시오."
    echo "  --help 로 사용법을 확인하십시오."
  fi

  echo ""
  echo "========================================"
  echo " 결과: PASS=${PASS} FAIL=${FAIL} WARN=${WARN} BREAKING=${BREAKING}"
  echo "========================================"

  if [[ -n "${report_file}" ]]; then
    generate_report "${report_file}"
  fi

  if [[ "${strict}" == "true" && ${BREAKING} -gt 0 ]]; then
    log "ERROR" "${BREAKING}건 파괴적 변경 감지. CI 실패."
    exit 1
  fi
}

main "$@"
