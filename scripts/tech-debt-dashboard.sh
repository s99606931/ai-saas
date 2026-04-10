#!/usr/bin/env bash
# =============================================================================
# 기술 부채 추적 대시보드
# Design Ref: MTU-N130 Design
# Plan SC: FR-N130.1, FR-N130.2, FR-N130.3, FR-N130.4
# CSAP: D-12(시스템 개발 보안 -- 코드 품질 관리)
#
# 사용법:
#   ./scripts/tech-debt-dashboard.sh                     # 전체 분석
#   ./scripts/tech-debt-dashboard.sh --category code     # 카테고리별
#   ./scripts/tech-debt-dashboard.sh --output-dir DIR    # 출력 경로
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/docs/reports/tech-debt"
AUDIT_LOG="$PROJECT_ROOT/.claude/audit.jsonl"
CATEGORY=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 전역 결과 변수 (함수 간 전달)
ASSESS_SCORE=0
ASSESS_MAX=5
ASSESS_DETAILS=""

log_info() { echo -e "${BLUE}[INFO]${NC} $(date '+%H:%M:%S') $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $(date '+%H:%M:%S') $1"; }

log_audit() {
  local action="$1"
  local detail="$2"
  local entry="{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"actor\":\"tech-debt-dashboard\",\"action\":\"$action\",\"detail\":\"$detail\"}"
  echo "$entry" >> "$AUDIT_LOG" 2>/dev/null || true
}

usage() {
  cat <<'USAGE'
사용법: tech-debt-dashboard.sh [옵션]

옵션:
  --category CAT     특정 카테고리만 분석 (code, dependency, documentation, test)
  --output-dir DIR   출력 디렉토리
  -h, --help         도움말

부채 카테고리:
  code           코드 부채 (TODO/FIXME, 대형 함수, 중복)
  dependency     의존성 부채 (오래된 패키지, 미사용)
  documentation  문서 부채 (미문서화 API, 오래된 문서)
  test           테스트 부채 (미테스트 모듈, 커버리지)
USAGE
  exit 0
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --category)   CATEGORY="$2"; shift 2 ;;
      --output-dir) OUTPUT_DIR="$2"; shift 2 ;;
      -h|--help)    usage ;;
      *)            log_info "알 수 없는 옵션: $1"; usage ;;
    esac
  done

  if [[ -n "$CATEGORY" ]]; then
    local valid="code dependency documentation test"
    if ! echo "$valid" | grep -qw "$CATEGORY"; then
      echo "유효하지 않은 카테고리: $CATEGORY"
      echo "유효 카테고리: $valid"
      exit 1
    fi
  fi
}

# 안전한 카운트 헬퍼
safe_count() {
  local result
  result=$("$@" 2>/dev/null | wc -l 2>/dev/null) || result=0
  echo "${result// /}"
}

# ---------------------------------------------------------------------------
# 코드 부채 분석
# ---------------------------------------------------------------------------
analyze_code_debt() {
  ASSESS_SCORE=0
  ASSESS_MAX=5
  ASSESS_DETAILS=""

  local todo_count=0
  todo_count=$(grep -r "TODO\|FIXME\|HACK\|XXX" "$PROJECT_ROOT/scripts" 2>/dev/null | wc -l) || todo_count=0
  todo_count="${todo_count// /}"
  if [[ "$todo_count" -lt 10 ]]; then
    ASSESS_SCORE=$((ASSESS_SCORE + 1))
    ASSESS_DETAILS="${ASSESS_DETAILS}- TODO/FIXME/HACK: ${todo_count}개 (양호)"$'\n'
  else
    ASSESS_DETAILS="${ASSESS_DETAILS}- TODO/FIXME/HACK: ${todo_count}개"$'\n'
  fi

  local large_files=0
  while IFS= read -r f; do
    local lines
    lines=$(wc -l < "$f" 2>/dev/null) || lines=0
    lines="${lines// /}"
    if [[ "$lines" -gt 800 ]]; then large_files=$((large_files + 1)); fi
  done < <(find "$PROJECT_ROOT/scripts" -name "*.sh" -type f 2>/dev/null)
  if [[ "$large_files" -eq 0 ]]; then
    ASSESS_SCORE=$((ASSESS_SCORE + 1))
    ASSESS_DETAILS="${ASSESS_DETAILS}- 대형 파일 (800줄+): ${large_files}개 (양호)"$'\n'
  else
    ASSESS_DETAILS="${ASSESS_DETAILS}- 대형 파일 (800줄+): ${large_files}개"$'\n'
  fi

  local commented_blocks=0
  if [[ -d "$PROJECT_ROOT/src" ]]; then
    commented_blocks=$(grep -rn "^\s*//.*function\|^\s*//.*class" "$PROJECT_ROOT/src" 2>/dev/null | wc -l) || commented_blocks=0
    commented_blocks="${commented_blocks// /}"
  fi
  if [[ "$commented_blocks" -lt 5 ]]; then
    ASSESS_SCORE=$((ASSESS_SCORE + 1))
    ASSESS_DETAILS="${ASSESS_DETAILS}- 주석 처리 코드: ${commented_blocks}개 (양호)"$'\n'
  else
    ASSESS_DETAILS="${ASSESS_DETAILS}- 주석 처리 코드: ${commented_blocks}개"$'\n'
  fi

  local console_logs=0
  if [[ -d "$PROJECT_ROOT/src" ]]; then
    console_logs=$(grep -r "console\.log" "$PROJECT_ROOT/src" 2>/dev/null | grep -v node_modules | wc -l) || console_logs=0
    console_logs="${console_logs// /}"
  fi
  if [[ "$console_logs" -lt 5 ]]; then
    ASSESS_SCORE=$((ASSESS_SCORE + 1))
    ASSESS_DETAILS="${ASSESS_DETAILS}- console.log 잔여: ${console_logs}개 (양호)"$'\n'
  else
    ASSESS_DETAILS="${ASSESS_DETAILS}- console.log 잔여: ${console_logs}개"$'\n'
  fi

  local script_count=0
  script_count=$(find "$PROJECT_ROOT/scripts" -name "*.sh" -type f 2>/dev/null | wc -l) || script_count=0
  script_count="${script_count// /}"
  if [[ "$script_count" -gt 0 ]]; then
    ASSESS_SCORE=$((ASSESS_SCORE + 1))
    ASSESS_DETAILS="${ASSESS_DETAILS}- 스크립트 관리: ${script_count}개 (체계적)"$'\n'
  else
    ASSESS_DETAILS="${ASSESS_DETAILS}- 스크립트 관리: 부재"$'\n'
  fi
}

# ---------------------------------------------------------------------------
# 의존성 부채 분석
# ---------------------------------------------------------------------------
analyze_dependency_debt() {
  ASSESS_SCORE=0
  ASSESS_MAX=5
  ASSESS_DETAILS=""

  local pkg_count=0
  pkg_count=$(find "$PROJECT_ROOT" -name "package.json" -not -path "*/node_modules/*" -maxdepth 3 2>/dev/null | wc -l) || pkg_count=0
  pkg_count="${pkg_count// /}"
  if [[ "$pkg_count" -gt 0 ]]; then
    ASSESS_SCORE=$((ASSESS_SCORE + 1))
    ASSESS_DETAILS="${ASSESS_DETAILS}- package.json: ${pkg_count}개 관리 중"$'\n'
  else
    ASSESS_DETAILS="${ASSESS_DETAILS}- package.json: 미발견"$'\n'
  fi

  if [[ -f "$PROJECT_ROOT/package-lock.json" ]] || [[ -f "$PROJECT_ROOT/pnpm-lock.yaml" ]] || [[ -f "$PROJECT_ROOT/yarn.lock" ]]; then
    ASSESS_SCORE=$((ASSESS_SCORE + 1))
    ASSESS_DETAILS="${ASSESS_DETAILS}- Lock 파일: 존재 (버전 고정)"$'\n'
  else
    ASSESS_DETAILS="${ASSESS_DETAILS}- Lock 파일: 미존재"$'\n'
  fi

  local dockerfile_count=0
  dockerfile_count=$(find "$PROJECT_ROOT" -name "Dockerfile" -not -path "*/node_modules/*" 2>/dev/null | wc -l) || dockerfile_count=0
  dockerfile_count="${dockerfile_count// /}"
  if [[ "$dockerfile_count" -gt 0 ]]; then
    ASSESS_SCORE=$((ASSESS_SCORE + 1))
    ASSESS_DETAILS="${ASSESS_DETAILS}- Dockerfile: ${dockerfile_count}개 존재"$'\n'
  else
    ASSESS_DETAILS="${ASSESS_DETAILS}- Dockerfile: 미발견"$'\n'
  fi

  local chart_count=0
  chart_count=$(find "$PROJECT_ROOT/infra" -name "Chart.yaml" 2>/dev/null | wc -l) || chart_count=0
  chart_count="${chart_count// /}"
  if [[ "$chart_count" -gt 0 ]]; then
    ASSESS_SCORE=$((ASSESS_SCORE + 1))
    ASSESS_DETAILS="${ASSESS_DETAILS}- Helm Chart: ${chart_count}개"$'\n'
  else
    ASSESS_DETAILS="${ASSESS_DETAILS}- Helm Chart: 미발견"$'\n'
  fi

  local env_count=0
  env_count=$(find "$PROJECT_ROOT" -name ".env.example" -o -name ".env.sample" 2>/dev/null | wc -l) || env_count=0
  env_count="${env_count// /}"
  if [[ "$env_count" -gt 0 ]]; then
    ASSESS_SCORE=$((ASSESS_SCORE + 1))
    ASSESS_DETAILS="${ASSESS_DETAILS}- 환경 변수 문서: ${env_count}개"$'\n'
  else
    ASSESS_DETAILS="${ASSESS_DETAILS}- 환경 변수 문서: 미존재"$'\n'
  fi
}

# ---------------------------------------------------------------------------
# 문서 부채 분석
# ---------------------------------------------------------------------------
analyze_documentation_debt() {
  ASSESS_SCORE=0
  ASSESS_MAX=5
  ASSESS_DETAILS=""

  if [[ -f "$PROJECT_ROOT/README.md" ]]; then
    local readme_lines=0
    readme_lines=$(wc -l < "$PROJECT_ROOT/README.md" 2>/dev/null) || readme_lines=0
    readme_lines="${readme_lines// /}"
    if [[ "$readme_lines" -gt 50 ]]; then
      ASSESS_SCORE=$((ASSESS_SCORE + 1))
      ASSESS_DETAILS="${ASSESS_DETAILS}- README.md: ${readme_lines}줄 (충실)"$'\n'
    else
      ASSESS_DETAILS="${ASSESS_DETAILS}- README.md: ${readme_lines}줄 (보완 필요)"$'\n'
    fi
  else
    ASSESS_DETAILS="${ASSESS_DETAILS}- README.md: 미존재"$'\n'
  fi

  local api_count=0
  api_count=$(find "$PROJECT_ROOT/docs" -name "*api*" 2>/dev/null | wc -l) || api_count=0
  api_count="${api_count// /}"
  if [[ "$api_count" -gt 0 ]]; then
    ASSESS_SCORE=$((ASSESS_SCORE + 1))
    ASSESS_DETAILS="${ASSESS_DETAILS}- API 문서: ${api_count}개"$'\n'
  else
    ASSESS_DETAILS="${ASSESS_DETAILS}- API 문서: 미존재"$'\n'
  fi

  local arch_count=0
  arch_count=$(find "$PROJECT_ROOT/docs" -name "*design*" 2>/dev/null | wc -l) || arch_count=0
  arch_count="${arch_count// /}"
  if [[ "$arch_count" -ge 3 ]]; then
    ASSESS_SCORE=$((ASSESS_SCORE + 1))
    ASSESS_DETAILS="${ASSESS_DETAILS}- 설계 문서: ${arch_count}개"$'\n'
  else
    ASSESS_DETAILS="${ASSESS_DETAILS}- 설계 문서: ${arch_count}개"$'\n'
  fi

  local ops_count=0
  if [[ -d "$PROJECT_ROOT/docs/operations" ]]; then
    ops_count=$(find "$PROJECT_ROOT/docs/operations" -name "*.md" 2>/dev/null | wc -l) || ops_count=0
    ops_count="${ops_count// /}"
  fi
  if [[ "$ops_count" -ge 3 ]]; then
    ASSESS_SCORE=$((ASSESS_SCORE + 1))
    ASSESS_DETAILS="${ASSESS_DETAILS}- 운영 문서: ${ops_count}개"$'\n'
  else
    ASSESS_DETAILS="${ASSESS_DETAILS}- 운영 문서: ${ops_count}개"$'\n'
  fi

  if [[ -f "$PROJECT_ROOT/CHANGELOG.md" ]]; then
    ASSESS_SCORE=$((ASSESS_SCORE + 1))
    ASSESS_DETAILS="${ASSESS_DETAILS}- CHANGELOG: 존재"$'\n'
  else
    ASSESS_DETAILS="${ASSESS_DETAILS}- CHANGELOG: 미존재"$'\n'
  fi
}

# ---------------------------------------------------------------------------
# 테스트 부채 분석
# ---------------------------------------------------------------------------
analyze_test_debt() {
  ASSESS_SCORE=0
  ASSESS_MAX=5
  ASSESS_DETAILS=""

  local test_count=0
  test_count=$(find "$PROJECT_ROOT/scripts" -name "test-*.sh" -type f 2>/dev/null | wc -l) || test_count=0
  test_count="${test_count// /}"
  if [[ "$test_count" -ge 10 ]]; then
    ASSESS_SCORE=$((ASSESS_SCORE + 1))
    ASSESS_DETAILS="${ASSESS_DETAILS}- E2E 테스트: ${test_count}개 (충분)"$'\n'
  else
    ASSESS_DETAILS="${ASSESS_DETAILS}- E2E 테스트: ${test_count}개"$'\n'
  fi

  local ci_test=0
  ci_test=$(grep -l "test\|Test" "$PROJECT_ROOT/.gitea/workflows/"*.yml 2>/dev/null | wc -l) || ci_test=0
  ci_test="${ci_test// /}"
  if [[ "$ci_test" -gt 0 ]]; then
    ASSESS_SCORE=$((ASSESS_SCORE + 1))
    ASSESS_DETAILS="${ASSESS_DETAILS}- CI 테스트: ${ci_test}개 워크플로우"$'\n'
  else
    ASSESS_DETAILS="${ASSESS_DETAILS}- CI 테스트: 미구성"$'\n'
  fi

  local exec_tests=0
  exec_tests=$(find "$PROJECT_ROOT/scripts" -name "test-*.sh" -executable 2>/dev/null | wc -l) || exec_tests=0
  exec_tests="${exec_tests// /}"
  if [[ "$exec_tests" -eq "$test_count" && "$test_count" -gt 0 ]]; then
    ASSESS_SCORE=$((ASSESS_SCORE + 1))
    ASSESS_DETAILS="${ASSESS_DETAILS}- 실행 가능: 전체 실행 가능"$'\n'
  else
    ASSESS_DETAILS="${ASSESS_DETAILS}- 실행 가능: ${exec_tests}/${test_count}"$'\n'
  fi

  local integ_tests=0
  integ_tests=$(find "$PROJECT_ROOT/scripts" -name "*integration*" -o -name "*e2e*" 2>/dev/null | wc -l) || integ_tests=0
  integ_tests="${integ_tests// /}"
  if [[ "$integ_tests" -gt 0 ]]; then
    ASSESS_SCORE=$((ASSESS_SCORE + 1))
    ASSESS_DETAILS="${ASSESS_DETAILS}- 통합 테스트: ${integ_tests}개"$'\n'
  else
    ASSESS_DETAILS="${ASSESS_DETAILS}- 통합 테스트: 미존재"$'\n'
  fi

  local sec_tests=0
  sec_tests=$(find "$PROJECT_ROOT/scripts" -name "*security*" -o -name "*audit*" 2>/dev/null | wc -l) || sec_tests=0
  sec_tests="${sec_tests// /}"
  if [[ "$sec_tests" -gt 0 ]]; then
    ASSESS_SCORE=$((ASSESS_SCORE + 1))
    ASSESS_DETAILS="${ASSESS_DETAILS}- 보안 테스트: ${sec_tests}개"$'\n'
  else
    ASSESS_DETAILS="${ASSESS_DETAILS}- 보안 테스트: 미존재"$'\n'
  fi
}

# ---------------------------------------------------------------------------
# 등급 판정
# ---------------------------------------------------------------------------
debt_grade() {
  local pct="$1"
  if [[ "$pct" -ge 80 ]]; then echo "A (양호)"
  elif [[ "$pct" -ge 60 ]]; then echo "B (보통)"
  elif [[ "$pct" -ge 40 ]]; then echo "C (주의)"
  elif [[ "$pct" -ge 20 ]]; then echo "D (심각)"
  else echo "F (위험)"; fi
}

# ---------------------------------------------------------------------------
# 권장 사항
# ---------------------------------------------------------------------------
generate_debt_recommendations() {
  local code_pct="$1" dep_pct="$2" doc_pct="$3" test_pct="$4"

  echo "### 리팩토링 우선순위 권장"
  echo ""

  local idx=1
  for entry in "code:${code_pct}:코드" "dependency:${dep_pct}:의존성" "documentation:${doc_pct}:문서" "test:${test_pct}:테스트"; do
    local cat pct name
    IFS=: read -r cat pct name <<< "$entry"
    if [[ "$pct" -lt 60 ]]; then
      echo "${idx}. **${name} 부채 해소 필요** (현재: ${pct}%)"
      case "$cat" in
        code)          echo "   - TODO/FIXME 정리, 대형 파일 분리" ;;
        dependency)    echo "   - 미사용 패키지 정리, 버전 업데이트" ;;
        documentation) echo "   - API 문서 자동 생성, 운영 Runbook 보완" ;;
        test)          echo "   - 미테스트 모듈 추가, CI 테스트 게이트" ;;
      esac
      echo ""
      idx=$((idx + 1))
    fi
  done

  if [[ "$idx" -eq 1 ]]; then
    echo "1. **모든 카테고리 양호** -- 현재 수준 유지"
    echo ""
  fi
}

# ---------------------------------------------------------------------------
# 보고서 생성
# ---------------------------------------------------------------------------
generate_report() {
  log_info "기술 부채 분석 시작..."
  log_audit "TECH_DEBT_ANALYSIS_START" "category=${CATEGORY:-all}"

  mkdir -p "$OUTPUT_DIR"

  local categories=("code" "dependency" "documentation" "test")
  local category_names=("코드 부채" "의존성 부채" "문서 부채" "테스트 부채")
  local category_weights=(30 20 20 30)

  if [[ -n "$CATEGORY" ]]; then
    case "$CATEGORY" in
      code)          categories=("code"); category_names=("코드 부채"); category_weights=(100) ;;
      dependency)    categories=("dependency"); category_names=("의존성 부채"); category_weights=(100) ;;
      documentation) categories=("documentation"); category_names=("문서 부채"); category_weights=(100) ;;
      test)          categories=("test"); category_names=("테스트 부채"); category_weights=(100) ;;
    esac
  fi

  local total_weighted_score=0
  local total_weight=0
  local results_table=""
  local detail_sections=""
  local code_pct=0 dep_pct=0 doc_pct=0 test_pct=0

  for i in "${!categories[@]}"; do
    local cat="${categories[$i]}"
    local cat_name="${category_names[$i]}"
    local weight="${category_weights[$i]}"

    # 평가 함수 호출 (전역 변수에 결과 저장)
    "analyze_${cat}_debt"

    local score=$ASSESS_SCORE
    local max=$ASSESS_MAX
    local details="$ASSESS_DETAILS"
    local pct=$((score * 100 / max))
    local grade
    grade=$(debt_grade "$pct")

    total_weighted_score=$((total_weighted_score + pct * weight))
    total_weight=$((total_weight + weight))

    case "$cat" in
      code)          code_pct=$pct ;;
      dependency)    dep_pct=$pct ;;
      documentation) doc_pct=$pct ;;
      test)          test_pct=$pct ;;
    esac

    local bar=""
    local j
    for ((j=0; j<score; j++)); do bar="${bar}#"; done
    for ((j=score; j<max; j++)); do bar="${bar}-"; done

    results_table="${results_table}| ${cat_name} | [${bar}] ${pct}% | ${grade} | ${score}/${max} | ${weight}% |"$'\n'

    detail_sections="${detail_sections}
### ${cat_name} (${grade})

점수: ${score}/${max} (${pct}%)

${details}
---
"
  done

  local overall_pct=0
  if [[ "$total_weight" -gt 0 ]]; then
    overall_pct=$((total_weighted_score / total_weight))
  fi
  local overall_grade
  overall_grade=$(debt_grade "$overall_pct")

  local recommendations
  recommendations=$(generate_debt_recommendations "$code_pct" "$dep_pct" "$doc_pct" "$test_pct")

  local report_date
  report_date=$(date +%Y-%m-%d)
  local output_file="$OUTPUT_DIR/tech-debt-${report_date}.md"
  local generated_at
  generated_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  cat > "$output_file" << REPORT
# 기술 부채 추적 대시보드

> CSAP: D-12(시스템 개발 보안 -- 코드 품질 관리)
> 생성일: ${generated_at}

---

## 1. 요약

| 항목 | 값 |
|------|------|
| 종합 점수 | **${overall_pct}%** |
| 종합 등급 | **${overall_grade}** |
| 분석 카테고리 | ${#categories[@]}개 |

---

## 2. 카테고리별 부채 현황

| 카테고리 | 진행도 | 등급 | 점수 | 가중치 |
|---------|--------|------|------|--------|
${results_table}

---

## 3. 등급 기준

| 등급 | 점수 | 의미 |
|------|------|------|
| A | 80~100% | 양호 -- 현 수준 유지 |
| B | 60~79% | 보통 -- 개선 검토 |
| C | 40~59% | 주의 -- 리팩토링 필요 |
| D | 20~39% | 심각 -- 즉시 조치 필요 |
| F | 0~19% | 위험 -- 긴급 대응 필요 |

---

## 4. 카테고리별 상세 분석

${detail_sections}

## 5. 리팩토링 권장 사항

${recommendations}

---

## 6. 감사 추적

| 항목 | 내용 |
|------|------|
| 분석 도구 | \`scripts/tech-debt-dashboard.sh\` |
| 감사 로그 | \`.claude/audit.jsonl\` |
| CSAP 참조 | D-12 시스템 개발 보안 |

---

> 이 보고서는 scripts/tech-debt-dashboard.sh에 의해 자동 생성되었습니다.
REPORT

  log_success "기술 부채 보고서 생성 완료: $output_file"
  log_audit "TECH_DEBT_ANALYSIS_COMPLETE" "output=$output_file overall=${overall_pct}%"

  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  기술 부채 분석 완료${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo -e "  종합 등급:    ${overall_grade}"
  echo -e "  종합 점수:    ${overall_pct}%"
  echo -e "  카테고리:     ${#categories[@]}개"
  echo -e "  출력 파일:    ${GREEN}${output_file}${NC}"
  echo -e "${CYAN}========================================${NC}"
}

main() {
  parse_args "$@"
  generate_report
}

main "$@"
