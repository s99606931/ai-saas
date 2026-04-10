#!/usr/bin/env bash
# =============================================================================
# SRE 성숙도 자가 평가 시스템
# Design Ref: MTU-N127 Design
# Plan SC: FR-N127.1, FR-N127.2, FR-N127.3, FR-N127.4
# CSAP: D-06(침해사고 관리 -- SRE 역량 평가)
#
# 사용법:
#   ./scripts/sre-maturity-assess.sh                 # 전체 평가
#   ./scripts/sre-maturity-assess.sh --domain monitoring  # 특정 영역
#   ./scripts/sre-maturity-assess.sh --output-dir DIR     # 출력 경로
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/docs/reports/sre-maturity"
AUDIT_LOG="$PROJECT_ROOT/.claude/audit.jsonl"
DOMAIN=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $(date '+%H:%M:%S') $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $(date '+%H:%M:%S') $1"; }

log_audit() {
  local action="$1"
  local detail="$2"
  local entry="{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"actor\":\"sre-maturity-assessor\",\"action\":\"$action\",\"detail\":\"$detail\"}"
  echo "$entry" >> "$AUDIT_LOG" 2>/dev/null || true
}

usage() {
  cat <<'USAGE'
사용법: sre-maturity-assess.sh [옵션]

옵션:
  --domain DOMAIN    특정 영역만 평가 (monitoring, incident, slo,
                     automation, capacity, security, deployment, documentation)
  --output-dir DIR   출력 디렉토리
  -h, --help         도움말

8개 SRE 성숙도 영역:
  monitoring     모니터링 (메트릭, 대시보드, 알림)
  incident       인시던트 관리 (감지, 대응, 포스트모템)
  slo            SLO/SLI (서비스 수준 목표, 에러 버짓)
  automation     자동화 (Runbook, 자동 복구)
  capacity       용량 계획 (리소스 예측, 확장)
  security       보안 (취약점 관리, 정책)
  deployment     배포 (CI/CD, 롤백, 카나리)
  documentation  문서화 (Runbook, 아키텍처, API)
USAGE
  exit 0
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --domain)     DOMAIN="$2"; shift 2 ;;
      --output-dir) OUTPUT_DIR="$2"; shift 2 ;;
      -h|--help)    usage ;;
      *)            log_info "알 수 없는 옵션: $1"; usage ;;
    esac
  done

  if [[ -n "$DOMAIN" ]]; then
    local valid_domains="monitoring incident slo automation capacity security deployment documentation"
    if ! echo "$valid_domains" | grep -qw "$DOMAIN"; then
      echo "유효하지 않은 영역: $DOMAIN"
      echo "유효 영역: $valid_domains"
      exit 1
    fi
  fi
}

# ---------------------------------------------------------------------------
# 평가 함수: 각 영역별 5개 항목 (0 or 1)
# ---------------------------------------------------------------------------

assess_monitoring() {
  local score=0
  local details=""

  # 1. Prometheus Recording Rules 존재
  local rule_count
  rule_count=$(find "$PROJECT_ROOT/infra/monitoring" -name "*rules*.yaml" -o -name "*recording*.yaml" 2>/dev/null | wc -l)
  if [[ "$rule_count" -ge 3 ]]; then
    score=$((score + 1))
    details="${details}Recording Rules: ${rule_count}개 존재\n"
  else
    details="${details}Recording Rules: ${rule_count}개 (3개 이상 권장)\n"
  fi

  # 2. Grafana 대시보드 존재
  local dash_count
  dash_count=$(find "$PROJECT_ROOT/infra/monitoring/dashboards" -name "*.json" -o -name "*.yaml" 2>/dev/null | wc -l)
  if [[ "$dash_count" -ge 5 ]]; then
    score=$((score + 1))
    details="${details}대시보드: ${dash_count}개 존재\n"
  else
    details="${details}대시보드: ${dash_count}개 (5개 이상 권장)\n"
  fi

  # 3. AlertManager 구성
  if [[ -f "$PROJECT_ROOT/infra/monitoring/alertmanager-config.yaml" ]]; then
    score=$((score + 1))
    details="${details}AlertManager 구성: 존재\n"
  else
    details="${details}AlertManager 구성: 미존재\n"
  fi

  # 4. 알림 노이즈 감소 구성
  if [[ -f "$PROJECT_ROOT/infra/monitoring/alertmanager-noise-reduction.yaml" ]]; then
    score=$((score + 1))
    details="${details}알림 노이즈 감소: 구성됨\n"
  else
    details="${details}알림 노이즈 감소: 미구성\n"
  fi

  # 5. 알림 피로도 분석
  if [[ -f "$PROJECT_ROOT/scripts/analyze-alert-fatigue.sh" ]]; then
    score=$((score + 1))
    details="${details}알림 피로도 분석: 도구 존재\n"
  else
    details="${details}알림 피로도 분석: 도구 없음\n"
  fi

  echo "${score}|${details}"
}

assess_incident() {
  local score=0
  local details=""

  # 1. 에스컬레이션 정책
  if [[ -f "$PROJECT_ROOT/docs/operations/escalation-policy.md" ]]; then
    score=$((score + 1))
    details="${details}에스컬레이션 정책: 존재\n"
  else
    details="${details}에스컬레이션 정책: 미존재\n"
  fi

  # 2. 포스트모템 도구
  if [[ -f "$PROJECT_ROOT/scripts/generate-postmortem.sh" ]]; then
    score=$((score + 1))
    details="${details}포스트모템 도구: 존재\n"
  else
    details="${details}포스트모템 도구: 미존재\n"
  fi

  # 3. 인시던트 분류 체계
  if [[ -f "$PROJECT_ROOT/docs/operations/incident-severity-matrix.md" ]]; then
    score=$((score + 1))
    details="${details}인시던트 분류 체계: 존재\n"
  else
    details="${details}인시던트 분류 체계: 미존재\n"
  fi

  # 4. 온콜 관리
  if [[ -f "$PROJECT_ROOT/scripts/oncall-status.sh" ]]; then
    score=$((score + 1))
    details="${details}온콜 관리: 도구 존재\n"
  else
    details="${details}온콜 관리: 도구 없음\n"
  fi

  # 5. 상태 페이지
  if [[ -f "$PROJECT_ROOT/scripts/generate-status-page.sh" ]]; then
    score=$((score + 1))
    details="${details}상태 페이지: 도구 존재\n"
  else
    details="${details}상태 페이지: 도구 없음\n"
  fi

  echo "${score}|${details}"
}

assess_slo() {
  local score=0
  local details=""

  # 1. SLO 보고서 도구
  if [[ -f "$PROJECT_ROOT/scripts/generate-slo-report.sh" ]]; then
    score=$((score + 1))
    details="${details}SLO 보고서 도구: 존재\n"
  else
    details="${details}SLO 보고서 도구: 미존재\n"
  fi

  # 2. SLO Recording Rules
  if [[ -f "$PROJECT_ROOT/infra/monitoring/slo-reporting-rules.yaml" ]]; then
    score=$((score + 1))
    details="${details}SLO Recording Rules: 존재\n"
  else
    details="${details}SLO Recording Rules: 미존재\n"
  fi

  # 3. 에러 버짓 알림
  if [[ -f "$PROJECT_ROOT/infra/monitoring/slo-error-budget-alerts.yaml" ]]; then
    score=$((score + 1))
    details="${details}에러 버짓 알림: 구성됨\n"
  else
    details="${details}에러 버짓 알림: 미구성\n"
  fi

  # 4. DORA 메트릭
  if [[ -f "$PROJECT_ROOT/scripts/generate-dora-report.sh" ]]; then
    score=$((score + 1))
    details="${details}DORA 메트릭: 도구 존재\n"
  else
    details="${details}DORA 메트릭: 도구 없음\n"
  fi

  # 5. Golden Signals 규칙
  if [[ -f "$PROJECT_ROOT/infra/monitoring/golden-signals-rules.yaml" ]]; then
    score=$((score + 1))
    details="${details}Golden Signals: 규칙 존재\n"
  else
    details="${details}Golden Signals: 규칙 없음\n"
  fi

  echo "${score}|${details}"
}

assess_automation() {
  local score=0
  local details=""

  # 1. 자동화 Runbook
  local runbook_count
  runbook_count=$(find "$PROJECT_ROOT/scripts" -name "runbook-auto-*.sh" 2>/dev/null | wc -l)
  if [[ "$runbook_count" -ge 3 ]]; then
    score=$((score + 1))
    details="${details}자동화 Runbook: ${runbook_count}개 존재\n"
  else
    details="${details}자동화 Runbook: ${runbook_count}개 (3개 이상 권장)\n"
  fi

  # 2. Runbook 라이브러리
  if [[ -f "$PROJECT_ROOT/scripts/runbook-lib.sh" ]]; then
    score=$((score + 1))
    details="${details}Runbook 라이브러리: 존재\n"
  else
    details="${details}Runbook 라이브러리: 미존재\n"
  fi

  # 3. 헬스체크 스크립트
  if [[ -f "$PROJECT_ROOT/scripts/healthcheck.sh" ]]; then
    score=$((score + 1))
    details="${details}헬스체크: 스크립트 존재\n"
  else
    details="${details}헬스체크: 스크립트 없음\n"
  fi

  # 4. 자동 배포 스크립트
  if [[ -f "$PROJECT_ROOT/scripts/deploy-to-k3s.sh" ]] || [[ -f "$PROJECT_ROOT/scripts/deploy-k8s.sh" ]]; then
    score=$((score + 1))
    details="${details}자동 배포: 스크립트 존재\n"
  else
    details="${details}자동 배포: 스크립트 없음\n"
  fi

  # 5. DB 백업/복원 자동화
  if [[ -f "$PROJECT_ROOT/scripts/db-backup.sh" ]] && [[ -f "$PROJECT_ROOT/scripts/db-restore.sh" ]]; then
    score=$((score + 1))
    details="${details}DB 백업/복원: 자동화 존재\n"
  else
    details="${details}DB 백업/복원: 자동화 미완성\n"
  fi

  echo "${score}|${details}"
}

assess_capacity() {
  local score=0
  local details=""

  # 1. 용량 알림 규칙
  if [[ -f "$PROJECT_ROOT/infra/monitoring/capacity-alerting-rules.yaml" ]]; then
    score=$((score + 1))
    details="${details}용량 알림: 규칙 존재\n"
  else
    details="${details}용량 알림: 규칙 없음\n"
  fi

  # 2. VPA 구성
  if [[ -f "$PROJECT_ROOT/infra/monitoring/vpa-alerting-rules.yaml" ]]; then
    score=$((score + 1))
    details="${details}VPA 구성: 존재\n"
  else
    details="${details}VPA 구성: 미존재\n"
  fi

  # 3. 예측 확장 규칙
  if [[ -f "$PROJECT_ROOT/infra/monitoring/predictive-scaling-rules.yaml" ]]; then
    score=$((score + 1))
    details="${details}예측 확장: 규칙 존재\n"
  else
    details="${details}예측 확장: 규칙 없음\n"
  fi

  # 4. FinOps 비용 규칙
  if [[ -f "$PROJECT_ROOT/infra/monitoring/finops-cost-rules.yaml" ]]; then
    score=$((score + 1))
    details="${details}FinOps 비용 규칙: 존재\n"
  else
    details="${details}FinOps 비용 규칙: 미존재\n"
  fi

  # 5. 용량 계획 대시보드
  if [[ -f "$PROJECT_ROOT/infra/monitoring/dashboards/capacity-planning.json" ]]; then
    score=$((score + 1))
    details="${details}용량 계획 대시보드: 존재\n"
  else
    details="${details}용량 계획 대시보드: 미존재\n"
  fi

  echo "${score}|${details}"
}

assess_security() {
  local score=0
  local details=""

  # 1. 보안 감사 스크립트
  if [[ -f "$PROJECT_ROOT/scripts/security-audit.sh" ]]; then
    score=$((score + 1))
    details="${details}보안 감사: 스크립트 존재\n"
  else
    details="${details}보안 감사: 스크립트 없음\n"
  fi

  # 2. NetworkPolicy
  local np_count
  np_count=$(find "$PROJECT_ROOT/infra" -name "*network*policy*" -o -name "*networkpolicy*" 2>/dev/null | wc -l)
  if [[ "$np_count" -ge 1 ]]; then
    score=$((score + 1))
    details="${details}NetworkPolicy: ${np_count}개 존재\n"
  else
    details="${details}NetworkPolicy: 미존재\n"
  fi

  # 3. 이미지 서명 (Cosign)
  local cosign_count
  cosign_count=$(find "$PROJECT_ROOT" -name "*cosign*" -o -name "*signing*" 2>/dev/null | grep -v node_modules | grep -v .git | wc -l)
  if [[ "$cosign_count" -ge 1 ]]; then
    score=$((score + 1))
    details="${details}이미지 서명: Cosign 구성 존재\n"
  else
    details="${details}이미지 서명: 미구성\n"
  fi

  # 4. CSAP 감사 모니터링
  if [[ -f "$PROJECT_ROOT/infra/monitoring/csap-audit-monitoring-rules.yaml" ]]; then
    score=$((score + 1))
    details="${details}CSAP 감사 모니터링: 구성됨\n"
  else
    details="${details}CSAP 감사 모니터링: 미구성\n"
  fi

  # 5. SBOM/공급망 보안
  local sbom_count
  sbom_count=$(find "$PROJECT_ROOT" -name "*sbom*" -o -name "*supply-chain*" 2>/dev/null | grep -v node_modules | grep -v .git | wc -l)
  if [[ "$sbom_count" -ge 1 ]]; then
    score=$((score + 1))
    details="${details}SBOM/공급망 보안: 구성 존재\n"
  else
    details="${details}SBOM/공급망 보안: 미구성\n"
  fi

  echo "${score}|${details}"
}

assess_deployment() {
  local score=0
  local details=""

  # 1. CI/CD 워크플로우
  local ci_count
  ci_count=$(find "$PROJECT_ROOT/.gitea/workflows" -name "*.yml" -o -name "*.yaml" 2>/dev/null | wc -l)
  if [[ "$ci_count" -ge 1 ]]; then
    score=$((score + 1))
    details="${details}CI/CD 워크플로우: ${ci_count}개 존재\n"
  else
    details="${details}CI/CD 워크플로우: 미존재\n"
  fi

  # 2. Helm 차트
  local helm_count
  helm_count=$(find "$PROJECT_ROOT/infra" -name "Chart.yaml" 2>/dev/null | wc -l)
  if [[ "$helm_count" -ge 1 ]]; then
    score=$((score + 1))
    details="${details}Helm 차트: ${helm_count}개 존재\n"
  else
    details="${details}Helm 차트: 미존재\n"
  fi

  # 3. 배포 체크리스트
  if [[ -f "$PROJECT_ROOT/docs/operations/oncall-handoff-checklist.md" ]] || find "$PROJECT_ROOT/docs" -name "*deploy*checklist*" 2>/dev/null | grep -q .; then
    score=$((score + 1))
    details="${details}배포 체크리스트: 존재\n"
  else
    details="${details}배포 체크리스트: 미존재\n"
  fi

  # 4. 릴리스 노트 자동화
  if [[ -f "$PROJECT_ROOT/scripts/generate-release-notes.sh" ]] || [[ -f "$PROJECT_ROOT/scripts/generate-release-notes-v2.sh" ]]; then
    score=$((score + 1))
    details="${details}릴리스 노트 자동화: 도구 존재\n"
  else
    details="${details}릴리스 노트 자동화: 도구 없음\n"
  fi

  # 5. 프로덕션 준비도 점검
  if [[ -f "$PROJECT_ROOT/scripts/prod-readiness-check.sh" ]] || [[ -f "$PROJECT_ROOT/scripts/production-readiness-check.sh" ]]; then
    score=$((score + 1))
    details="${details}프로덕션 준비도 점검: 도구 존재\n"
  else
    details="${details}프로덕션 준비도 점검: 도구 없음\n"
  fi

  echo "${score}|${details}"
}

assess_documentation() {
  local score=0
  local details=""

  # 1. SRE Runbook 문서
  local runbook_doc_count
  runbook_doc_count=$(find "$PROJECT_ROOT/docs" -name "*runbook*" 2>/dev/null | wc -l)
  if [[ "$runbook_doc_count" -ge 1 ]]; then
    score=$((score + 1))
    details="${details}SRE Runbook 문서: ${runbook_doc_count}개 존재\n"
  else
    details="${details}SRE Runbook 문서: 미존재\n"
  fi

  # 2. API 문서
  if [[ -f "$PROJECT_ROOT/scripts/generate-api-docs.sh" ]]; then
    score=$((score + 1))
    details="${details}API 문서 도구: 존재\n"
  else
    details="${details}API 문서 도구: 미존재\n"
  fi

  # 3. 아키텍처 다이어그램
  if [[ -f "$PROJECT_ROOT/scripts/generate-arch-diagram.sh" ]]; then
    score=$((score + 1))
    details="${details}아키텍처 다이어그램 도구: 존재\n"
  else
    details="${details}아키텍처 다이어그램 도구: 미존재\n"
  fi

  # 4. 서비스 토폴로지 문서
  if [[ -f "$PROJECT_ROOT/scripts/service-topology.sh" ]]; then
    score=$((score + 1))
    details="${details}서비스 토폴로지: 도구 존재\n"
  else
    details="${details}서비스 토폴로지: 도구 없음\n"
  fi

  # 5. 운영 가이드 (operations 디렉토리)
  local ops_count
  ops_count=$(find "$PROJECT_ROOT/docs/operations" -name "*.md" 2>/dev/null | wc -l)
  if [[ "$ops_count" -ge 3 ]]; then
    score=$((score + 1))
    details="${details}운영 가이드: ${ops_count}개 존재\n"
  else
    details="${details}운영 가이드: ${ops_count}개 (3개 이상 권장)\n"
  fi

  echo "${score}|${details}"
}

# ---------------------------------------------------------------------------
# 등급 판정 (FR-N127.2)
# ---------------------------------------------------------------------------
score_to_level() {
  local score="$1"
  if [[ "$score" -ge 5 ]]; then
    echo "L5 (최적화)"
  elif [[ "$score" -ge 4 ]]; then
    echo "L4 (관리)"
  elif [[ "$score" -ge 3 ]]; then
    echo "L3 (정의)"
  elif [[ "$score" -ge 2 ]]; then
    echo "L2 (반복)"
  else
    echo "L1 (초기)"
  fi
}

score_to_pct() {
  local score="$1"
  echo "$((score * 20))"
}

# ---------------------------------------------------------------------------
# 개선 권장 사항 (FR-N127.3)
# ---------------------------------------------------------------------------
generate_domain_recommendations() {
  local domain="$1"
  local score="$2"

  if [[ "$score" -ge 5 ]]; then
    echo "현재 수준 우수. 지속적 개선 및 모니터링 유지."
    return
  fi

  case "$domain" in
    monitoring)
      [[ "$score" -lt 3 ]] && echo "- Recording Rule 추가 필요 (현재 보유 규칙 확인)"
      [[ "$score" -lt 4 ]] && echo "- Grafana 대시보드 추가 (서비스별 RED 메트릭)"
      [[ "$score" -lt 5 ]] && echo "- 알림 피로도 정기 분석 체계 구축"
      ;;
    incident)
      [[ "$score" -lt 3 ]] && echo "- 인시던트 분류 체계 정의 (P1~P4)"
      [[ "$score" -lt 4 ]] && echo "- 포스트모템 프로세스 정례화"
      [[ "$score" -lt 5 ]] && echo "- 상태 페이지 실시간 운영"
      ;;
    slo)
      [[ "$score" -lt 3 ]] && echo "- 핵심 서비스 SLO 정의 및 모니터링"
      [[ "$score" -lt 4 ]] && echo "- 에러 버짓 소진 알림 구성"
      [[ "$score" -lt 5 ]] && echo "- DORA 메트릭 주간 리뷰 체계 구축"
      ;;
    automation)
      [[ "$score" -lt 3 ]] && echo "- 반복 작업 자동화 Runbook 작성"
      [[ "$score" -lt 4 ]] && echo "- 자동 복구 스크립트 추가"
      [[ "$score" -lt 5 ]] && echo "- DB 백업/복원 자동화 완성"
      ;;
    capacity)
      [[ "$score" -lt 3 ]] && echo "- 리소스 사용량 알림 규칙 추가"
      [[ "$score" -lt 4 ]] && echo "- VPA/HPA 자동 확장 구성"
      [[ "$score" -lt 5 ]] && echo "- 예측 기반 용량 계획 수립"
      ;;
    security)
      [[ "$score" -lt 3 ]] && echo "- NetworkPolicy 정의 및 적용"
      [[ "$score" -lt 4 ]] && echo "- 이미지 서명 파이프라인 구축"
      [[ "$score" -lt 5 ]] && echo "- SBOM 자동 생성 및 공급망 보안 강화"
      ;;
    deployment)
      [[ "$score" -lt 3 ]] && echo "- CI/CD 파이프라인 자동화"
      [[ "$score" -lt 4 ]] && echo "- 배포 체크리스트 정의"
      [[ "$score" -lt 5 ]] && echo "- Canary/Blue-Green 배포 전략 적용"
      ;;
    documentation)
      [[ "$score" -lt 3 ]] && echo "- SRE Runbook 문서 작성"
      [[ "$score" -lt 4 ]] && echo "- API 문서 자동화"
      [[ "$score" -lt 5 ]] && echo "- 서비스 토폴로지 및 의존성 문서화"
      ;;
  esac
}

# ---------------------------------------------------------------------------
# 보고서 생성 (FR-N127.4)
# ---------------------------------------------------------------------------
generate_report() {
  log_info "SRE 성숙도 자가 평가 시작..."
  log_audit "SRE_MATURITY_ASSESS_START" "domain=${DOMAIN:-all}"

  mkdir -p "$OUTPUT_DIR"

  local domains=("monitoring" "incident" "slo" "automation" "capacity" "security" "deployment" "documentation")
  local domain_names=("모니터링" "인시던트 관리" "SLO/SLI" "자동화" "용량 계획" "보안" "배포" "문서화")

  if [[ -n "$DOMAIN" ]]; then
    domains=("$DOMAIN")
    case "$DOMAIN" in
      monitoring)     domain_names=("모니터링") ;;
      incident)       domain_names=("인시던트 관리") ;;
      slo)            domain_names=("SLO/SLI") ;;
      automation)     domain_names=("자동화") ;;
      capacity)       domain_names=("용량 계획") ;;
      security)       domain_names=("보안") ;;
      deployment)     domain_names=("배포") ;;
      documentation)  domain_names=("문서화") ;;
    esac
  fi

  local total_score=0
  local total_max=0
  local results=""
  local detail_sections=""

  for i in "${!domains[@]}"; do
    local domain="${domains[$i]}"
    local domain_name="${domain_names[$i]}"

    local result
    result=$(assess_"$domain")
    local score
    score=$(echo "$result" | cut -d'|' -f1)
    local details
    details=$(echo "$result" | cut -d'|' -f2)

    local level
    level=$(score_to_level "$score")
    local pct
    pct=$(score_to_pct "$score")

    total_score=$((total_score + score))
    total_max=$((total_max + 5))

    # 진행 막대
    local bar=""
    local j
    for ((j=0; j<score; j++)); do bar="${bar}#"; done
    for ((j=score; j<5; j++)); do bar="${bar}-"; done

    results="${results}| ${domain_name} | [${bar}] ${pct}% | ${level} | ${score}/5 |\n"

    local recommendations
    recommendations=$(generate_domain_recommendations "$domain" "$score")

    detail_sections="${detail_sections}
### ${domain_name} (${level})

점수: ${score}/5 (${pct}%)

평가 항목:
$(echo -e "$details" | sed 's/^/- /')

권장 사항:
${recommendations}

---
"
  done

  # 종합 점수
  local overall_pct=0
  if [[ "$total_max" -gt 0 ]]; then
    overall_pct=$((total_score * 100 / total_max))
  fi
  local overall_level
  local overall_score_per5=$((total_score * 5 / total_max))
  overall_level=$(score_to_level "$overall_score_per5")

  local report_date
  report_date=$(date +%Y-%m-%d)
  local output_file="$OUTPUT_DIR/sre-maturity-${report_date}.md"
  local generated_at
  generated_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  cat > "$output_file" << REPORT
# SRE 성숙도 자가 평가 보고서

> CSAP: D-06(침해사고 관리 -- SRE 역량 평가)
> 생성일: ${generated_at}
> 평가 영역: ${#domains[@]}개

---

## 1. 요약

| 항목 | 값 |
|------|------|
| 종합 성숙도 | **${overall_level}** (${overall_pct}%) |
| 총점 | ${total_score} / ${total_max} |
| 평가 영역 수 | ${#domains[@]} |

---

## 2. 영역별 성숙도

| 영역 | 진행도 | 등급 | 점수 |
|------|--------|------|------|
$(echo -e "$results")

---

## 3. 성숙도 등급 기준

| 등급 | 점수 | 설명 |
|------|------|------|
| L5 최적화 | 5/5 (100%) | 지속적 개선 프로세스 정착 |
| L4 관리 | 4/5 (80%) | 메트릭 기반 관리 체계 구축 |
| L3 정의 | 3/5 (60%) | 표준 프로세스 정의 및 적용 |
| L2 반복 | 2/5 (40%) | 기본 도구 도입, 반복 가능 |
| L1 초기 | 0-1/5 (0-20%) | Ad-hoc 대응, 체계 미비 |

---

## 4. 영역별 상세 분석

${detail_sections}

## 5. 감사 추적

| 항목 | 내용 |
|------|------|
| 평가 도구 | \`scripts/sre-maturity-assess.sh\` |
| 감사 로그 | \`.claude/audit.jsonl\` |
| 평가 기준 | Google SRE Workbook 기반 |

---

> 이 보고서는 scripts/sre-maturity-assess.sh에 의해 자동 생성되었습니다.
REPORT

  log_success "SRE 성숙도 보고서 생성 완료: $output_file"
  log_audit "SRE_MATURITY_ASSESS_COMPLETE" "output=$output_file overall=${overall_pct}%"

  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  SRE 성숙도 자가 평가 완료${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo -e "  종합 등급:    ${overall_level}"
  echo -e "  종합 점수:    ${total_score}/${total_max} (${overall_pct}%)"
  echo -e "  평가 영역:    ${#domains[@]}개"
  echo -e "  출력 파일:    ${GREEN}${output_file}${NC}"
  echo -e "${CYAN}========================================${NC}"
}

main() {
  parse_args "$@"
  generate_report
}

main "$@"
