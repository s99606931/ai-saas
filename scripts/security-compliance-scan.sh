#!/usr/bin/env bash
# =============================================================================
# 보안 규정 준수 스캐너
# Design Ref: MTU-N131 Design
# Plan SC: FR-N131.1, FR-N131.2, FR-N131.3, FR-N131.4
# CSAP: D-08(접근통제), D-09(암호화), D-12(개발보안), D-06(감사)
#
# 사용법:
#   ./scripts/security-compliance-scan.sh                    # 전체 스캔
#   ./scripts/security-compliance-scan.sh --rule SECRET      # 특정 규칙
#   ./scripts/security-compliance-scan.sh --output-dir DIR   # 출력 경로
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/docs/reports/security-compliance"
AUDIT_LOG="$PROJECT_ROOT/.claude/audit.jsonl"
RULE_FILTER=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 전역 카운터
TOTAL_RULES=0
PASS_RULES=0
WARN_RULES=0
FAIL_RULES=0
FINDINGS=""

log_info() { echo -e "${BLUE}[INFO]${NC} $(date '+%H:%M:%S') $1"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $(date '+%H:%M:%S') $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $(date '+%H:%M:%S') $1"; }
log_error() { echo -e "${RED}[FAIL]${NC} $(date '+%H:%M:%S') $1"; }

log_audit() {
  local action="$1"
  local detail="$2"
  local entry="{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"actor\":\"security-compliance-scanner\",\"action\":\"$action\",\"detail\":\"$detail\"}"
  echo "$entry" >> "$AUDIT_LOG" 2>/dev/null || true
}

usage() {
  cat <<'USAGE'
사용법: security-compliance-scan.sh [옵션]

옵션:
  --rule RULE        특정 규칙만 스캔 (SECRET, SQLI, AUTH, CRYPTO, LOG)
  --output-dir DIR   출력 디렉토리
  -h, --help         도움말

스캔 규칙:
  SECRET   하드코딩 시크릿 탐지 (D-09)
  SQLI     SQL 주입 위험 패턴 (D-12)
  AUTH     인증/인가 미적용 (D-08)
  CRYPTO   약한 암호화 (D-09)
  LOG      민감 데이터 로깅 (D-06)
USAGE
  exit 0
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --rule)       RULE_FILTER="$2"; shift 2 ;;
      --output-dir) OUTPUT_DIR="$2"; shift 2 ;;
      -h|--help)    usage ;;
      *)            log_info "알 수 없는 옵션: $1"; usage ;;
    esac
  done

  if [[ -n "$RULE_FILTER" ]]; then
    local valid="SECRET SQLI AUTH CRYPTO LOG"
    if ! echo "$valid" | grep -qw "$RULE_FILTER"; then
      echo "유효하지 않은 규칙: $RULE_FILTER"
      echo "유효 규칙: $valid"
      exit 1
    fi
  fi
}

# ---------------------------------------------------------------------------
# 스캔 헬퍼
# ---------------------------------------------------------------------------
record_finding() {
  local rule="$1"
  local severity="$2"
  local csap="$3"
  local desc="$4"
  local count="$5"

  TOTAL_RULES=$((TOTAL_RULES + 1))

  if [[ "$count" -eq 0 ]]; then
    PASS_RULES=$((PASS_RULES + 1))
    FINDINGS="${FINDINGS}| ${rule} | ${csap} | PASS | ${desc} | 0건 |"$'\n'
  elif [[ "$severity" == "HIGH" ]]; then
    FAIL_RULES=$((FAIL_RULES + 1))
    FINDINGS="${FINDINGS}| ${rule} | ${csap} | FAIL | ${desc} | ${count}건 |"$'\n'
  else
    WARN_RULES=$((WARN_RULES + 1))
    FINDINGS="${FINDINGS}| ${rule} | ${csap} | WARN | ${desc} | ${count}건 |"$'\n'
  fi
}

# 소스 코드 디렉토리 탐색 (존재하는 것만)
get_scan_dirs() {
  local dirs=""
  for d in "$PROJECT_ROOT/src" "$PROJECT_ROOT/services" "$PROJECT_ROOT/packages" "$PROJECT_ROOT/scripts"; do
    [[ -d "$d" ]] && dirs="$dirs $d"
  done
  echo "$dirs"
}

# ---------------------------------------------------------------------------
# SECRET: 하드코딩 시크릿 탐지 (FR-N131.1)
# ---------------------------------------------------------------------------
scan_secrets() {
  log_info "SECRET 규칙 스캔..."
  local scan_dirs
  scan_dirs=$(get_scan_dirs)

  # SECRET-01: API 키 패턴
  local api_key_count=0
  if [[ -n "$scan_dirs" ]]; then
    api_key_count=$(grep -rn "api[_-]*key\s*=\s*['\"][a-zA-Z0-9]" $scan_dirs 2>/dev/null | grep -v node_modules | grep -v "\.example" | grep -v "process\.env" | grep -v "ENV\[" | grep -v "# " | grep -v "-- " | wc -l) || api_key_count=0
    api_key_count="${api_key_count// /}"
  fi
  record_finding "SECRET-01" "HIGH" "D-09" "하드코딩 API 키" "$api_key_count"

  # SECRET-02: 비밀번호 패턴
  local pwd_count=0
  if [[ -n "$scan_dirs" ]]; then
    pwd_count=$(grep -rn "password\s*=\s*['\"][^$]" $scan_dirs 2>/dev/null | grep -v node_modules | grep -v "\.example" | grep -v "process\.env" | grep -v "test" | grep -v "mock" | grep -v "# " | wc -l) || pwd_count=0
    pwd_count="${pwd_count// /}"
  fi
  record_finding "SECRET-02" "HIGH" "D-09" "하드코딩 비밀번호" "$pwd_count"

  # SECRET-03: 토큰/시크릿 패턴
  local token_count=0
  if [[ -n "$scan_dirs" ]]; then
    token_count=$(grep -rn "secret\s*=\s*['\"][a-zA-Z0-9]" $scan_dirs 2>/dev/null | grep -v node_modules | grep -v "\.example" | grep -v "process\.env" | grep -v "# " | wc -l) || token_count=0
    token_count="${token_count// /}"
  fi
  record_finding "SECRET-03" "HIGH" "D-09" "하드코딩 토큰/시크릿" "$token_count"
}

# ---------------------------------------------------------------------------
# SQLI: SQL 주입 위험 탐지 (FR-N131.2)
# ---------------------------------------------------------------------------
scan_sqli() {
  log_info "SQLI 규칙 스캔..."
  local scan_dirs
  scan_dirs=$(get_scan_dirs)

  # SQLI-01: SQL 문자열 결합
  local sqli_count=0
  if [[ -n "$scan_dirs" ]]; then
    sqli_count=$(grep -rn "SELECT.*FROM.*\$\|INSERT.*INTO.*\$\|UPDATE.*SET.*\$\|DELETE.*FROM.*\$" $scan_dirs 2>/dev/null | grep -v node_modules | grep -v "test" | grep -v "# " | grep -v "-- " | wc -l) || sqli_count=0
    sqli_count="${sqli_count// /}"
  fi
  record_finding "SQLI-01" "HIGH" "D-12" "SQL 문자열 결합 (주입 위험)" "$sqli_count"

  # SQLI-02: eval/exec 사용
  local eval_count=0
  if [[ -n "$scan_dirs" ]]; then
    eval_count=$(grep -rn "\beval\b\|new Function(" $scan_dirs 2>/dev/null | grep -v node_modules | grep -v "test" | grep -v "# " | wc -l) || eval_count=0
    eval_count="${eval_count// /}"
  fi
  record_finding "SQLI-02" "MED" "D-12" "eval/exec 사용 (코드 주입 위험)" "$eval_count"
}

# ---------------------------------------------------------------------------
# AUTH: 인증/인가 미적용 탐지 (FR-N131.3)
# ---------------------------------------------------------------------------
scan_auth() {
  log_info "AUTH 규칙 스캔..."

  # AUTH-01: .env 파일 커밋 여부
  local env_count=0
  env_count=$(find "$PROJECT_ROOT" -name ".env" -not -path "*/node_modules/*" -not -name ".env.example" -not -name ".env.sample" 2>/dev/null | wc -l) || env_count=0
  env_count="${env_count// /}"
  record_finding "AUTH-01" "HIGH" "D-08" ".env 파일 존재 (커밋 위험)" "$env_count"

  # AUTH-02: .gitignore에 .env 포함 여부
  local gitignore_env=0
  if [[ -f "$PROJECT_ROOT/.gitignore" ]]; then
    if ! grep -q "\.env" "$PROJECT_ROOT/.gitignore" 2>/dev/null; then
      gitignore_env=1
    fi
  else
    gitignore_env=1
  fi
  record_finding "AUTH-02" "HIGH" "D-08" ".gitignore에 .env 미포함" "$gitignore_env"
}

# ---------------------------------------------------------------------------
# CRYPTO: 약한 암호화 탐지
# ---------------------------------------------------------------------------
scan_crypto() {
  log_info "CRYPTO 규칙 스캔..."
  local scan_dirs
  scan_dirs=$(get_scan_dirs)

  # CRYPTO-01: MD5 사용
  local md5_count=0
  if [[ -n "$scan_dirs" ]]; then
    md5_count=$(grep -rn "\bmd5\b\|MD5\b\|createHash.*md5" $scan_dirs 2>/dev/null | grep -v node_modules | grep -v "test" | grep -v "# " | wc -l) || md5_count=0
    md5_count="${md5_count// /}"
  fi
  record_finding "CRYPTO-01" "MED" "D-09" "MD5 사용 (약한 해시)" "$md5_count"

  # CRYPTO-02: SHA1 사용
  local sha1_count=0
  if [[ -n "$scan_dirs" ]]; then
    sha1_count=$(grep -rn "\bsha1\b\|SHA1\b\|createHash.*sha1" $scan_dirs 2>/dev/null | grep -v node_modules | grep -v "test" | grep -v "# " | wc -l) || sha1_count=0
    sha1_count="${sha1_count// /}"
  fi
  record_finding "CRYPTO-02" "MED" "D-09" "SHA1 사용 (약한 해시)" "$sha1_count"
}

# ---------------------------------------------------------------------------
# LOG: 민감 데이터 로깅 탐지
# ---------------------------------------------------------------------------
scan_logging() {
  log_info "LOG 규칙 스캔..."
  local scan_dirs
  scan_dirs=$(get_scan_dirs)

  # LOG-01: 비밀번호/토큰 로깅
  local log_sensitive=0
  if [[ -n "$scan_dirs" ]]; then
    log_sensitive=$(grep -rn "console\.\(log\|info\|debug\).*password\|console\.\(log\|info\|debug\).*token\|console\.\(log\|info\|debug\).*secret" $scan_dirs 2>/dev/null | grep -v node_modules | grep -v "test" | wc -l) || log_sensitive=0
    log_sensitive="${log_sensitive// /}"
  fi
  record_finding "LOG-01" "HIGH" "D-06" "민감 데이터 로깅" "$log_sensitive"

  # LOG-02: 스택 트레이스 노출
  local stack_count=0
  if [[ -n "$scan_dirs" ]]; then
    stack_count=$(grep -rn "\.stack\|stackTrace\|e\.message" $scan_dirs 2>/dev/null | grep -v node_modules | grep -v "test" | grep -v "logger" | wc -l) || stack_count=0
    stack_count="${stack_count// /}"
  fi
  record_finding "LOG-02" "MED" "D-06" "스택 트레이스 노출 가능" "$stack_count"
}

# ---------------------------------------------------------------------------
# 보고서 생성 (FR-N131.4)
# ---------------------------------------------------------------------------
generate_report() {
  log_info "보안 규정 준수 스캔 시작..."
  log_audit "SECURITY_COMPLIANCE_SCAN_START" "rule=${RULE_FILTER:-all}"

  mkdir -p "$OUTPUT_DIR"

  # 스캔 실행
  if [[ -z "$RULE_FILTER" ]]; then
    scan_secrets
    scan_sqli
    scan_auth
    scan_crypto
    scan_logging
  else
    case "$RULE_FILTER" in
      SECRET) scan_secrets ;;
      SQLI)   scan_sqli ;;
      AUTH)   scan_auth ;;
      CRYPTO) scan_crypto ;;
      LOG)    scan_logging ;;
    esac
  fi

  # 종합 판정
  local overall="PASS"
  if [[ "$FAIL_RULES" -gt 0 ]]; then
    overall="FAIL"
  elif [[ "$WARN_RULES" -gt 0 ]]; then
    overall="WARN"
  fi

  local report_date
  report_date=$(date +%Y-%m-%d)
  local output_file="$OUTPUT_DIR/security-scan-${report_date}.md"
  local generated_at
  generated_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  cat > "$output_file" << REPORT
# 보안 규정 준수 스캔 보고서

> CSAP: D-08(접근통제), D-09(암호화), D-12(개발보안), D-06(감사)
> 생성일: ${generated_at}

---

## 1. 요약

| 항목 | 값 |
|------|------|
| 종합 판정 | **${overall}** |
| 스캔 규칙 수 | ${TOTAL_RULES} |
| 통과 | ${PASS_RULES} |
| 주의 | ${WARN_RULES} |
| 실패 | ${FAIL_RULES} |

---

## 2. 스캔 결과

| 규칙 | CSAP | 판정 | 설명 | 발견 |
|------|------|------|------|------|
${FINDINGS}

---

## 3. CSAP 통제항목 매핑

| CSAP | 통제항목 | 관련 규칙 |
|------|---------|----------|
| D-06 | 침해사고 관리 | LOG-01, LOG-02 |
| D-08 | 접근 통제 | AUTH-01, AUTH-02 |
| D-09 | 암호화 | SECRET-01~03, CRYPTO-01~02 |
| D-12 | 시스템 개발 보안 | SQLI-01, SQLI-02 |

---

## 4. 조치 가이드

### FAIL 항목 (즉시 조치)
- **하드코딩 시크릿**: 환경 변수 또는 Secret Manager로 전환
- **.env 파일**: .gitignore에 추가, 커밋 이력에서 제거
- **SQL 주입**: 매개변수화 쿼리 사용
- **민감 데이터 로깅**: 마스킹 처리 적용

### WARN 항목 (검토 후 조치)
- **약한 해시**: SHA-256 또는 bcrypt로 전환 검토
- **eval 사용**: 대체 구현 검토
- **스택 트레이스**: 프로덕션 에러 응답에서 제거

---

## 5. 감사 추적

| 항목 | 내용 |
|------|------|
| 스캔 도구 | \`scripts/security-compliance-scan.sh\` |
| 감사 로그 | \`.claude/audit.jsonl\` |

---

> 이 보고서는 scripts/security-compliance-scan.sh에 의해 자동 생성되었습니다.
REPORT

  log_success "보안 스캔 보고서 생성 완료: $output_file"
  log_audit "SECURITY_COMPLIANCE_SCAN_COMPLETE" "output=$output_file result=$overall pass=$PASS_RULES warn=$WARN_RULES fail=$FAIL_RULES"

  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  보안 규정 준수 스캔 완료${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo -e "  종합 판정:    ${overall}"
  echo -e "  스캔 규칙:    ${TOTAL_RULES}"
  echo -e "  통과:         ${GREEN}${PASS_RULES}${NC}"
  echo -e "  주의:         ${YELLOW}${WARN_RULES}${NC}"
  echo -e "  실패:         ${RED}${FAIL_RULES}${NC}"
  echo -e "  출력 파일:    ${GREEN}${output_file}${NC}"
  echo -e "${CYAN}========================================${NC}"
}

main() {
  parse_args "$@"
  generate_report
}

main "$@"
