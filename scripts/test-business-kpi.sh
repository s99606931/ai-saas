#!/bin/bash
# Design Ref: MTU-N239
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0
check() {
  TOTAL=$((TOTAL + 1))
  if [ "$2" = "0" ]; then echo "  [PASS] $1"; PASS=$((PASS + 1))
  else echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); fi
}

echo "============================================"
echo " MTU-N239: 비즈니스 KPI 대시보드 검증"
echo "============================================"

echo ""
echo "[TC-01] Recording Rules"
test -f infra/monitoring/rules/business-kpi-rules.yaml; check "KPI Rules 파일 존재" $?
grep -q "saas:tenants:active_total" infra/monitoring/rules/business-kpi-rules.yaml; check "테넌트 수 메트릭" $?
grep -q "saas:mau:total" infra/monitoring/rules/business-kpi-rules.yaml; check "MAU 메트릭" $?
grep -q "saas:dau:total" infra/monitoring/rules/business-kpi-rules.yaml; check "DAU 메트릭" $?
grep -q "saas:availability:ratio" infra/monitoring/rules/business-kpi-rules.yaml; check "가용성 메트릭" $?
grep -q "saas:api:success_ratio" infra/monitoring/rules/business-kpi-rules.yaml; check "API 성공률 메트릭" $?
grep -q "saas:api:latency_p95" infra/monitoring/rules/business-kpi-rules.yaml; check "P95 응답시간 메트릭" $?
grep -q "saas:error_budget" infra/monitoring/rules/business-kpi-rules.yaml; check "에러 예산 메트릭" $?
grep -q "saas:deployment:frequency" infra/monitoring/rules/business-kpi-rules.yaml; check "배포 빈도 메트릭" $?
grep -q "saas:mttr" infra/monitoring/rules/business-kpi-rules.yaml; check "MTTR 메트릭" $?

echo ""
echo "[TC-02] Alert Rules"
test -f infra/monitoring/alerts/business-kpi-alerts.yaml; check "Alert Rules 파일 존재" $?
grep -q "PlatformAvailabilityLow" infra/monitoring/alerts/business-kpi-alerts.yaml; check "가용성 알림" $?
grep -q "APISuccessRateLow" infra/monitoring/alerts/business-kpi-alerts.yaml; check "API 성공률 알림" $?
grep -q "ErrorBudgetExhausted" infra/monitoring/alerts/business-kpi-alerts.yaml; check "에러 예산 알림" $?
grep -q "DeploymentFailureRateHigh" infra/monitoring/alerts/business-kpi-alerts.yaml; check "배포 실패율 알림" $?

echo ""
echo "[TC-03] Grafana 대시보드"
test -f infra/monitoring/dashboards/business-kpi-dashboard.json; check "대시보드 파일 존재" $?
grep -q "Executive KPI" infra/monitoring/dashboards/business-kpi-dashboard.json; check "Executive 제목" $?
grep -q "business-kpi-executive" infra/monitoring/dashboards/business-kpi-dashboard.json; check "대시보드 UID" $?
grep -q "gauge" infra/monitoring/dashboards/business-kpi-dashboard.json; check "게이지 패널 포함" $?
grep -q "timeseries" infra/monitoring/dashboards/business-kpi-dashboard.json; check "시계열 패널 포함" $?

echo ""
echo "[TC-04] KPI 보고서 스크립트"
test -f scripts/generate-kpi-report.sh; check "보고서 스크립트 존재" $?
grep -q "query_prometheus" scripts/generate-kpi-report.sh; check "Prometheus 쿼리 함수" $?
grep -q "DORA" scripts/generate-kpi-report.sh; check "DORA 메트릭 포함" $?

echo ""
echo "[TC-05] Design/Plan 추적성"
grep -q "Design Ref" infra/monitoring/rules/business-kpi-rules.yaml; check "Rules Design Ref" $?
grep -q "Plan SC" infra/monitoring/rules/business-kpi-rules.yaml; check "Rules Plan SC" $?

echo ""
echo "============================================"
echo " 결과: $PASS / $TOTAL PASS  ($FAIL FAIL)"
echo "============================================"
[ "$FAIL" -eq 0 ] && echo "ALL TESTS PASSED" || echo "SOME TESTS FAILED"
