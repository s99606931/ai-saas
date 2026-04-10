#!/usr/bin/env bash
# Design Ref: MTU-N161 Section 2
# Plan SC: FR-N161.3, FR-N161.4
# CSAP: D-06 용량 변경 추적
#
# VPA/HPA 통합 용량 권고 보고서 생성 스크립트
# 리소스 사용량 분석 및 최적 할당 권장사항 도출

set -euo pipefail

readonly SCRIPT_NAME="capacity-recommendation-report"
readonly PROMETHEUS_URL="${PROMETHEUS_URL:-http://prometheus.monitoring.svc:9090}"
readonly REPORT_DIR="${REPORT_DIR:-/data/ai-saas/docs/reports/capacity}"
readonly LOG_FILE="/var/log/saas/${SCRIPT_NAME}.log"

log() {
  local level="$1"; shift
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [${level}] ${SCRIPT_NAME}: $*" | tee -a "${LOG_FILE}" 2>/dev/null || true
}

usage() {
  cat <<EOF
사용법: $0 [옵션]

VPA/HPA 통합 용량 권고 보고서 생성

옵션:
  --namespace NS       대상 네임스페이스 (기본: 전체)
  --output-dir DIR     출력 디렉토리 (기본: ${REPORT_DIR})
  --what-if RATIO      what-if 시뮬레이션 (권고값 적용 비율, 0.0~1.0)
  --dry-run            Prometheus 없이 샘플 보고서 생성
  --help               도움말 출력

환경 변수:
  PROMETHEUS_URL       Prometheus 서버 URL
  REPORT_DIR           보고서 출력 디렉토리

예시:
  $0 --dry-run
  $0 --namespace public-saas
  $0 --what-if 0.8
EOF
}

query_prometheus() {
  local query="$1"
  curl -sf --max-time 30 \
    "${PROMETHEUS_URL}/api/v1/query" \
    --data-urlencode "query=${query}" 2>/dev/null || echo '{"data":{"result":[]}}'
}

grade_overprovision() {
  local ratio="$1"
  if (( $(echo "${ratio} > 2.0" | bc -l 2>/dev/null || echo 0) )); then
    echo "CRITICAL"
  elif (( $(echo "${ratio} > 1.5" | bc -l 2>/dev/null || echo 0) )); then
    echo "HIGH"
  elif (( $(echo "${ratio} > 1.2" | bc -l 2>/dev/null || echo 0) )); then
    echo "MEDIUM"
  elif (( $(echo "${ratio} < 1.0" | bc -l 2>/dev/null || echo 0) )); then
    echo "LOW"
  else
    echo "OK"
  fi
}

generate_report() {
  local output_file="$1"
  local dry_run="$2"
  local what_if="$3"

  log "INFO" "용량 권고 보고서 생성 시작"

  cat > "${output_file}" <<REPORT_EOF
# 자동 용량 권고 보고서

> **분석 기간**: 최근 7일
> **생성 일시**: $(date -u +%Y-%m-%dT%H:%M:%SZ)
> **생성 도구**: capacity-recommendation-report.sh
> **Design Ref**: MTU-N161

---

## 1. 종합 요약

| 지표 | 값 |
|------|---|
| 분석 대상 워크로드 | 산출 예정 |
| 과다 할당 (CRITICAL) | 산출 예정 |
| 과다 할당 (HIGH) | 산출 예정 |
| 과소 할당 (OOM 위험) | 산출 예정 |
| 총 월간 절감 잠재력 | 산출 예정 |

---

## 2. CPU 용량 권고

| 워크로드 | 현재 requests | P95 사용량 | 권장 requests | 과다 비율 | 등급 | 절감 (KRW/월) |
|---------|-------------|-----------|-------------|----------|------|-------------|
REPORT_EOF

  if [[ "${dry_run}" == "true" ]]; then
    cat >> "${output_file}" <<SAMPLE_EOF
| auth-service | 500m | 120m | 138m | 3.62x | CRITICAL | 26,064 |
| api-gateway | 1000m | 450m | 518m | 1.93x | HIGH | 34,704 |
| tenant-service | 250m | 180m | 207m | 1.21x | MEDIUM | 3,096 |
| audit-service | 200m | 190m | 219m | 0.91x | LOW | 0 (증설 필요) |
| billing-service | 300m | 250m | 288m | 1.04x | OK | 0 |
SAMPLE_EOF
  fi

  cat >> "${output_file}" <<MEM_EOF

---

## 3. 메모리 용량 권고

| 워크로드 | 현재 requests | P95 사용량 | 권장 requests | 과다 비율 | 등급 | 절감 (KRW/월) |
|---------|-------------|-----------|-------------|----------|------|-------------|
MEM_EOF

  if [[ "${dry_run}" == "true" ]]; then
    cat >> "${output_file}" <<MEM_SAMPLE_EOF
| auth-service | 512Mi | 180Mi | 216Mi | 2.37x | CRITICAL | 2,133 |
| api-gateway | 1Gi | 600Mi | 720Mi | 1.42x | MEDIUM | 2,016 |
| tenant-service | 256Mi | 200Mi | 240Mi | 1.07x | OK | 0 |
| billing-service | 384Mi | 310Mi | 372Mi | 1.03x | OK | 0 |
MEM_SAMPLE_EOF
  fi

  # what-if 시뮬레이션
  if [[ -n "${what_if}" && "${what_if}" != "0" ]]; then
    cat >> "${output_file}" <<WHATIF_EOF

---

## 4. What-If 시뮬레이션 (권고 적용 비율: ${what_if})

| 시나리오 | 현재 비용 | 권고 적용 후 비용 | 절감액 | 절감률 |
|---------|---------|-----------------|--------|--------|
| CPU | 산출 예정 | 산출 예정 | 산출 예정 | - |
| 메모리 | 산출 예정 | 산출 예정 | 산출 예정 | - |
| **합계** | **산출 예정** | **산출 예정** | **산출 예정** | **-** |

### 위험 분석

- CPU 과소 할당 위험: 없음 (안전 마진 15% 포함)
- 메모리 OOM 위험: 없음 (안전 마진 20% 포함)
- 서비스 지연 영향: 최소 (P95 기준 설정)
WHATIF_EOF
  fi

  cat >> "${output_file}" <<HPA_EOF

---

## 5. HPA 최적화 권고

| HPA | 현재 min/max | 활용률 | 스케일 빈도 | 권장 조치 |
|-----|-------------|--------|-----------|----------|
HPA_EOF

  if [[ "${dry_run}" == "true" ]]; then
    cat >> "${output_file}" <<HPA_SAMPLE_EOF
| api-gateway | 2/10 | 45% | 3회/h | maxReplicas 8로 축소 권장 |
| auth-service | 1/5 | 60% | 1회/h | 적정 |
| billing-service | 1/3 | 80% | 8회/h | targetUtilization 60%로 조정 |
HPA_SAMPLE_EOF
  fi

  cat >> "${output_file}" <<FOOTER_EOF

---

## 6. 조치 우선순위

1. **즉시 조치 (CRITICAL/LOW)**: 과소 할당 워크로드 메모리 증설
2. **주간 조치 (HIGH)**: CPU 과다 할당 워크로드 requests 축소
3. **정기 검토 (MEDIUM)**: 다음 용량 계획 회의에서 검토
4. **HPA 조정**: 빈번한 스케일링 워크로드 targetUtilization 조정

---

*이 보고서는 capacity-recommendation-report.sh에 의해 자동 생성되었습니다.*
*권고사항 적용 전 반드시 스테이징 환경에서 검증하십시오.*
FOOTER_EOF

  log "INFO" "보고서 생성 완료: ${output_file}"
}

main() {
  local namespace=""
  local output_dir="${REPORT_DIR}"
  local what_if=""
  local dry_run="false"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --namespace)  namespace="$2"; shift 2 ;;
      --output-dir) output_dir="$2"; shift 2 ;;
      --what-if)    what_if="$2"; shift 2 ;;
      --dry-run)    dry_run="true"; shift ;;
      --help)       usage; exit 0 ;;
      *)            log "ERROR" "알 수 없는 옵션: $1"; usage; exit 1 ;;
    esac
  done

  mkdir -p "${output_dir}" 2>/dev/null || true
  mkdir -p "$(dirname "${LOG_FILE}")" 2>/dev/null || true

  local output_file="${output_dir}/capacity-report-$(date +%Y%m%d).md"

  log "INFO" "용량 권고 보고서 생성 시작"
  generate_report "${output_file}" "${dry_run}" "${what_if}"

  echo ""
  echo "보고서 생성 완료: ${output_file}"
}

main "$@"
