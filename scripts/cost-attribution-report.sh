#!/usr/bin/env bash
# Design Ref: MTU-N160 Section 3
# Plan SC: FR-N160.5
# CSAP: D-06 침해사고관리 (비용 추적 보고서)
#
# 월간 테넌트별 비용 정산 보고서 생성 스크립트
# Prometheus API에서 비용 메트릭을 조회하여 Markdown 보고서 생성

set -euo pipefail

readonly SCRIPT_NAME="cost-attribution-report"
readonly PROMETHEUS_URL="${PROMETHEUS_URL:-http://prometheus.monitoring.svc:9090}"
readonly REPORT_DIR="${REPORT_DIR:-/data/ai-saas/docs/reports/cost}"
readonly LOG_FILE="/var/log/saas/${SCRIPT_NAME}.log"

log() {
  local level="$1"; shift
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [${level}] ${SCRIPT_NAME}: $*" | tee -a "${LOG_FILE}" 2>/dev/null || true
}

usage() {
  cat <<EOF
사용법: $0 [옵션]

월간 테넌트별 비용 정산 보고서 생성

옵션:
  --month YYYY-MM     대상 월 (기본: 이전 월)
  --output-dir DIR    보고서 출력 디렉토리 (기본: ${REPORT_DIR})
  --format FORMAT     출력 형식: markdown|json (기본: markdown)
  --dry-run           Prometheus 쿼리 없이 샘플 보고서 생성
  --help              도움말 출력

환경 변수:
  PROMETHEUS_URL      Prometheus 서버 URL
  REPORT_DIR          보고서 출력 디렉토리

예시:
  $0 --month 2026-03
  $0 --dry-run
EOF
}

query_prometheus() {
  local query="$1"
  local time="${2:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

  curl -sf --max-time 30 \
    "${PROMETHEUS_URL}/api/v1/query" \
    --data-urlencode "query=${query}" \
    --data-urlencode "time=${time}" 2>/dev/null || echo '{"data":{"result":[]}}'
}

generate_markdown_report() {
  local month="$1"
  local output_file="$2"
  local dry_run="$3"

  local year="${month%-*}"
  local mon="${month#*-}"

  log "INFO" "보고서 생성 시작: ${month}"

  cat > "${output_file}" <<REPORT_EOF
# 테넌트별 비용 정산 보고서

> **정산 기간**: ${month}-01 ~ ${month}-$(cal "${mon}" "${year}" | awk 'NF{a=$NF}END{print a}' 2>/dev/null || echo "30")
> **생성 일시**: $(date -u +%Y-%m-%dT%H:%M:%SZ)
> **생성 도구**: cost-attribution-report.sh
> **Design Ref**: MTU-N160

---

## 1. 전체 비용 요약

| 항목 | 금액 (KRW) |
|------|-----------|
| CPU 비용 | 산출 예정 |
| 메모리 비용 | 산출 예정 |
| 스토리지 비용 | 산출 예정 |
| 네트워크 비용 | 산출 예정 |
| **총 비용** | **산출 예정** |

---

## 2. 테넌트별 비용 상세

| 테넌트 | CPU (KRW) | 메모리 (KRW) | 스토리지 (KRW) | 네트워크 (KRW) | 합계 (KRW) |
|--------|----------|-------------|---------------|---------------|-----------|
REPORT_EOF

  if [[ "${dry_run}" == "true" ]]; then
    cat >> "${output_file}" <<SAMPLE_EOF
| tenant-alpha | 36,000 | 7,200 | 10,000 | 2,500 | 55,700 |
| tenant-beta | 24,000 | 4,800 | 5,000 | 1,200 | 35,000 |
| tenant-gamma | 12,000 | 2,400 | 3,000 | 800 | 18,200 |
| public-saas | 48,000 | 9,600 | 15,000 | 5,000 | 77,600 |
| **합계** | **120,000** | **24,000** | **33,000** | **9,500** | **186,500** |
SAMPLE_EOF
  else
    local namespaces
    namespaces=$(query_prometheus 'tenant_cost:monthly_estimated_krw' | \
      python3 -c "import sys,json; data=json.load(sys.stdin); [print(r['metric'].get('namespace','unknown')) for r in data.get('data',{}).get('result',[])]" 2>/dev/null || echo "")

    if [[ -z "${namespaces}" ]]; then
      echo "| (데이터 없음) | - | - | - | - | - |" >> "${output_file}"
    else
      for ns in ${namespaces}; do
        local cpu_cost mem_cost storage_cost net_cost total_cost
        cpu_cost=$(query_prometheus "tenant_cost:cpu_hourly_krw{namespace=\"${ns}\"} * 720" | \
          python3 -c "import sys,json; data=json.load(sys.stdin); r=data.get('data',{}).get('result',[]); print(int(float(r[0]['value'][1])) if r else 0)" 2>/dev/null || echo "0")
        mem_cost=$(query_prometheus "tenant_cost:memory_hourly_krw{namespace=\"${ns}\"} * 720" | \
          python3 -c "import sys,json; data=json.load(sys.stdin); r=data.get('data',{}).get('result',[]); print(int(float(r[0]['value'][1])) if r else 0)" 2>/dev/null || echo "0")
        storage_cost=$(query_prometheus "tenant_cost:storage_hourly_krw{namespace=\"${ns}\"} * 720" | \
          python3 -c "import sys,json; data=json.load(sys.stdin); r=data.get('data',{}).get('result',[]); print(int(float(r[0]['value'][1])) if r else 0)" 2>/dev/null || echo "0")
        net_cost=$(query_prometheus "tenant_cost:network_hourly_krw{namespace=\"${ns}\"} * 720" | \
          python3 -c "import sys,json; data=json.load(sys.stdin); r=data.get('data',{}).get('result',[]); print(int(float(r[0]['value'][1])) if r else 0)" 2>/dev/null || echo "0")
        total_cost=$((cpu_cost + mem_cost + storage_cost + net_cost))

        printf "| %s | %s | %s | %s | %s | %s |\n" \
          "${ns}" \
          "$(printf "%'d" "${cpu_cost}")" \
          "$(printf "%'d" "${mem_cost}")" \
          "$(printf "%'d" "${storage_cost}")" \
          "$(printf "%'d" "${net_cost}")" \
          "$(printf "%'d" "${total_cost}")" >> "${output_file}"
      done
    fi
  fi

  cat >> "${output_file}" <<FOOTER_EOF

---

## 3. 비용 효율 분석

| 테넌트 | CPU 효율 | 메모리 효율 | 권장 조치 |
|--------|---------|-----------|----------|
| (Prometheus 메트릭 기반 자동 산출) | - | - | - |

---

## 4. 비용 최적화 권장사항

- CPU 사용률 20% 미만 테넌트: 리소스 요청량 축소 권장
- 메모리 사용률 20% 미만 테넌트: 리소스 요청량 축소 권장
- 네트워크 비용 높은 테넌트: 토폴로지 인식 라우팅 활성화 확인

---

*이 보고서는 cost-attribution-report.sh에 의해 자동 생성되었습니다.*
FOOTER_EOF

  log "INFO" "보고서 생성 완료: ${output_file}"
}

main() {
  local month=""
  local output_dir="${REPORT_DIR}"
  local format="markdown"
  local dry_run="false"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --month)      month="$2"; shift 2 ;;
      --output-dir) output_dir="$2"; shift 2 ;;
      --format)     format="$2"; shift 2 ;;
      --dry-run)    dry_run="true"; shift ;;
      --help)       usage; exit 0 ;;
      *)            log "ERROR" "알 수 없는 옵션: $1"; usage; exit 1 ;;
    esac
  done

  # 기본값: 이전 월
  if [[ -z "${month}" ]]; then
    month=$(date -d "last month" +%Y-%m 2>/dev/null || date -v-1m +%Y-%m 2>/dev/null || echo "2026-03")
  fi

  mkdir -p "${output_dir}" 2>/dev/null || true
  mkdir -p "$(dirname "${LOG_FILE}")" 2>/dev/null || true

  local output_file="${output_dir}/cost-report-${month}.md"

  log "INFO" "비용 정산 보고서 생성 시작 (기간: ${month})"

  if [[ "${format}" == "markdown" ]]; then
    generate_markdown_report "${month}" "${output_file}" "${dry_run}"
  else
    log "ERROR" "지원하지 않는 형식: ${format}"
    exit 1
  fi

  echo ""
  echo "보고서 생성 완료: ${output_file}"
}

main "$@"
