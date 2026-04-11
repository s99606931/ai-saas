#!/usr/bin/env bash
# =============================================================================
# AIOps RCA 자동 보고서 생성
# Design Ref: MTU-N252 Design §2.4
# Plan SC: FR-N252.4
# CSAP: D-06(침해사고 관리 -- 근본 원인 분석 보고서)
#
# 사용법:
#   ./scripts/generate-rca-report.sh                    # 현재 상태 분석
#   ./scripts/generate-rca-report.sh --dry-run          # 샘플 데이터
#   ./scripts/generate-rca-report.sh --namespace saas-prod
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/docs/reports/rca"
AUDIT_LOG="$PROJECT_ROOT/.claude/audit.jsonl"

PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
NAMESPACE="all"
DRY_RUN=false
REPORT_DATE=$(date +%Y-%m-%d)
REPORT_TIME=$(date +%H:%M:%S)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[RCA]${NC} $(date '+%H:%M:%S') $1"; }
log_success() { echo -e "${GREEN}[RCA]${NC} $(date '+%H:%M:%S') $1"; }

log_audit() {
  local action="$1"
  local detail="$2"
  echo "{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"actor\":\"rca-report\",\"action\":\"$action\",\"detail\":\"$detail\",\"csap_ref\":\"D-06\"}" >> "$AUDIT_LOG" 2>/dev/null || true
}

usage() {
  cat <<'USAGE'
사용법: generate-rca-report.sh [옵션]

옵션:
  --namespace NS    대상 네임스페이스 (기본: all)
  --date DATE       기준일 (기본: 오늘)
  --output-dir DIR  출력 디렉토리
  --dry-run         API 없이 샘플 데이터
  -h, --help        도움말

RCA 분석 10개 패턴:
  1. CPU 병목     → 수평 확장
  2. 메모리 누수  → 프로파일링
  3. 업스트림 장애 → 의존성 점검
  4. 디스크 병목  → 스토리지 확장
  5. 네트워크 문제 → DNS/MTU 점검
  6. 앱 버그      → 롤백
  7. 노드 장애    → 노드 교체
  8. 스토리지 부족 → PV 확장
  9. 최근 배포    → 롤백
 10. DNS 병목    → CoreDNS 조정
USAGE
  exit 0
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --namespace)  NAMESPACE="$2"; shift 2 ;;
      --date)       REPORT_DATE="$2"; shift 2 ;;
      --output-dir) OUTPUT_DIR="$2"; shift 2 ;;
      --dry-run)    DRY_RUN=true; shift ;;
      -h|--help)    usage ;;
      *)            log_info "알 수 없는 옵션: $1"; usage ;;
    esac
  done
}

query_prometheus() {
  local query="$1"
  local default="${2:-0}"
  if [[ "$DRY_RUN" == "true" ]]; then echo "$default"; return; fi
  curl -s --connect-timeout 5 --max-time 10 \
    "${PROMETHEUS_URL}/api/v1/query?query=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$query'))" 2>/dev/null || echo "$query")" \
    | jq -r '.data.result[0].value[1] // "'"$default"'"' 2>/dev/null || echo "$default"
}

generate_report() {
  log_info "RCA 보고서 생성 시작 (${REPORT_DATE} ${REPORT_TIME})"

  local active_patterns cpu_score mem_score err_score lat_score max_score

  if [[ "$DRY_RUN" == "true" ]]; then
    active_patterns="2"
    cpu_score="4.2"
    mem_score="1.1"
    err_score="3.8"
    lat_score="2.5"
    max_score="4.2"
  else
    active_patterns=$(query_prometheus "rca:active_patterns:count" "0")
    cpu_score=$(query_prometheus "max(rca:anomaly_score:cpu)" "0")
    mem_score=$(query_prometheus "max(rca:anomaly_score:memory)" "0")
    err_score=$(query_prometheus "max(rca:anomaly_score:error_rate)" "0")
    lat_score=$(query_prometheus "max(rca:anomaly_score:latency)" "0")
    max_score=$(query_prometheus "rca:max_anomaly_score" "0")
  fi

  mkdir -p "$OUTPUT_DIR"
  local report_file="${OUTPUT_DIR}/rca-${REPORT_DATE}-${REPORT_TIME//:/}.md"

  cat > "$report_file" <<EOF
# AIOps RCA 분석 보고서

> **일시**: ${REPORT_DATE} ${REPORT_TIME}
> **범위**: ${NAMESPACE}
> **활성 RCA 패턴**: ${active_patterns}개
> **최대 이상 스코어**: ${max_score}
> **CSAP 참조**: D-06 (침해사고 관리)

---

## 이상 스코어 현황

| 차원 | Z-Score | 상태 |
|------|---------|------|
| CPU | ${cpu_score} | $([ "$(echo "$cpu_score > 3" | bc 2>/dev/null || echo 0)" = "1" ] && echo "이상" || echo "정상") |
| Memory | ${mem_score} | $([ "$(echo "$mem_score > 3" | bc 2>/dev/null || echo 0)" = "1" ] && echo "이상" || echo "정상") |
| Error Rate | ${err_score} | $([ "$(echo "$err_score > 3" | bc 2>/dev/null || echo 0)" = "1" ] && echo "이상" || echo "정상") |
| Latency | ${lat_score} | $([ "$(echo "$lat_score > 3" | bc 2>/dev/null || echo 0)" = "1" ] && echo "이상" || echo "정상") |

## 활성 RCA 패턴

활성 패턴 ${active_patterns}개가 감지되었습니다.
상세 분석은 Grafana 대시보드 /d/rca-analysis 에서 확인하십시오.

## 권고 조치

이상 스코어가 3 이상인 차원에 대해 RCA 패턴을 확인하고,
알림의 rca_action 레이블에 명시된 조치를 수행하십시오.

---

*보고서 생성: $(date -u +"%Y-%m-%dT%H:%M:%SZ") | generate-rca-report.sh*
EOF

  log_success "RCA 보고서 생성 완료: ${report_file}"
  log_audit "RCA_REPORT_GENERATED" "date=${REPORT_DATE},active=${active_patterns},max_score=${max_score}"

  echo ""
  echo -e "${BOLD}=== RCA 분석 요약 ===${NC}"
  echo -e "활성 RCA 패턴: ${active_patterns}개"
  echo -e "최대 이상 스코어: ${max_score}"
  echo -e "CPU: ${cpu_score} | Memory: ${mem_score} | Error: ${err_score} | Latency: ${lat_score}"
}

main() {
  parse_args "$@"
  generate_report
}

main "$@"
