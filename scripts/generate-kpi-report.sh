#!/bin/bash
# Design Ref: MTU-N239
# Plan SC: FR-KPI.5
# 주간 KPI 보고서 자동 생성

set -euo pipefail

PROMETHEUS_URL="${PROMETHEUS_URL:-http://prometheus:9090}"
OUTPUT_DIR="${1:-docs/pm-reports}"
DATE=$(date '+%Y-%m-%d')
REPORT_FILE="$OUTPUT_DIR/kpi-weekly-$DATE.md"

echo "============================================"
echo " 주간 KPI 보고서 생성"
echo " 날짜: $DATE"
echo "============================================"

query_prometheus() {
  local query="$1"
  local result
  result=$(curl -sf "$PROMETHEUS_URL/api/v1/query?query=$(echo "$query" | jq -sRr @uri)" 2>/dev/null \
    | jq -r '.data.result[0].value[1] // "N/A"' 2>/dev/null || echo "N/A")
  echo "$result"
}

# KPI 데이터 수집
TENANTS=$(query_prometheus "saas:tenants:active_total")
MAU=$(query_prometheus "saas:mau:total")
DAU=$(query_prometheus "saas:dau:total")
AVAILABILITY=$(query_prometheus "saas:availability:ratio * 100")
API_SUCCESS=$(query_prometheus "saas:api:success_ratio * 100")
LATENCY_P95=$(query_prometheus "saas:api:latency_p95 * 1000")
ERROR_BUDGET=$(query_prometheus "saas:error_budget:consumed_ratio * 100")
DEPLOY_FREQ=$(query_prometheus "saas:deployment:frequency_weekly")
DEPLOY_FAIL=$(query_prometheus "saas:deployment:failure_ratio * 100")
MTTR=$(query_prometheus "saas:mttr:seconds / 60")

mkdir -p "$OUTPUT_DIR"

cat > "$REPORT_FILE" <<REPORTEOF
# 주간 KPI 보고서 -- $DATE

> 자동 생성: $(date '+%Y-%m-%d %H:%M:%S')

## 핵심 지표 요약

| KPI | 현재 값 | 목표 | 상태 |
|-----|---------|------|------|
| 활성 테넌트 | $TENANTS | 증가 추세 | - |
| MAU | $MAU | 증가 추세 | - |
| DAU | $DAU | 증가 추세 | - |
| 플랫폼 가용성 | ${AVAILABILITY}% | >= 99.9% | $([ "$AVAILABILITY" = "N/A" ] && echo "-" || echo "확인필요") |
| API 성공률 | ${API_SUCCESS}% | >= 99.5% | $([ "$API_SUCCESS" = "N/A" ] && echo "-" || echo "확인필요") |
| API P95 응답시간 | ${LATENCY_P95}ms | < 500ms | $([ "$LATENCY_P95" = "N/A" ] && echo "-" || echo "확인필요") |
| 에러 예산 소진율 | ${ERROR_BUDGET}% | < 80% | $([ "$ERROR_BUDGET" = "N/A" ] && echo "-" || echo "확인필요") |

## DORA 메트릭

| 메트릭 | 값 | 등급 기준 |
|--------|-----|---------|
| 배포 빈도 | ${DEPLOY_FREQ}회/주 | Elite: 일 다수, High: 일~주 |
| 배포 실패율 | ${DEPLOY_FAIL}% | Elite: 0-5%, High: 0-10% |
| MTTR | ${MTTR}분 | Elite: < 1시간, High: < 24시간 |
REPORTEOF

echo ""
echo "보고서 생성 완료: $REPORT_FILE"
