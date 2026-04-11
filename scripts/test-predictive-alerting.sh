#!/bin/bash
# Design Ref: MTU-N242
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0
check() {
  TOTAL=$((TOTAL + 1))
  if [ "$2" = "0" ]; then echo "  [PASS] $1"; PASS=$((PASS + 1))
  else echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); fi
}

echo "============================================"
echo " MTU-N242: 예측적 장애 방지 검증"
echo "============================================"

echo ""
echo "[TC-01] 예측 알림 규칙"
test -f infra/monitoring/alerts/predictive-alerts.yaml; check "알림 규칙 파일 존재" $?
grep -q "predict_linear" infra/monitoring/alerts/predictive-alerts.yaml; check "predict_linear 사용" $?
grep -q "DiskWillFillIn4Hours" infra/monitoring/alerts/predictive-alerts.yaml; check "디스크 4시간 예측" $?
grep -q "DiskWillFillIn24Hours" infra/monitoring/alerts/predictive-alerts.yaml; check "디스크 24시간 예측" $?
grep -q "DiskWillFillIn7Days" infra/monitoring/alerts/predictive-alerts.yaml; check "디스크 7일 예측" $?
grep -q "MemoryOOMPredicted" infra/monitoring/alerts/predictive-alerts.yaml; check "메모리 OOM 예측" $?
grep -q "CertExpiringIn30Days" infra/monitoring/alerts/predictive-alerts.yaml; check "인증서 30일 예측" $?
grep -q "CertExpiringIn7Days" infra/monitoring/alerts/predictive-alerts.yaml; check "인증서 7일 예측" $?
grep -q "CertExpiringIn1Day" infra/monitoring/alerts/predictive-alerts.yaml; check "인증서 1일 예측" $?
grep -q "SLOViolationPredicted" infra/monitoring/alerts/predictive-alerts.yaml; check "SLO 위반 예측" $?
grep -q "PVWillFillIn24Hours" infra/monitoring/alerts/predictive-alerts.yaml; check "PV 포화 예측" $?

echo ""
echo "[TC-02] 심각도 등급"
grep -q 'severity: critical' infra/monitoring/alerts/predictive-alerts.yaml; check "Critical 등급 사용" $?
grep -q 'severity: warning' infra/monitoring/alerts/predictive-alerts.yaml; check "Warning 등급 사용" $?
grep -q 'severity: info' infra/monitoring/alerts/predictive-alerts.yaml; check "Info 등급 사용" $?
grep -q 'category: predictive' infra/monitoring/alerts/predictive-alerts.yaml; check "예측 카테고리 라벨" $?

echo ""
echo "[TC-03] 예측 대시보드"
test -f infra/monitoring/dashboards/predictive-alerting-dashboard.json; check "대시보드 파일 존재" $?
grep -q "predict_linear" infra/monitoring/dashboards/predictive-alerting-dashboard.json; check "예측 쿼리 포함" $?
grep -q "인증서 만료" infra/monitoring/dashboards/predictive-alerting-dashboard.json; check "인증서 패널" $?
grep -q "에러 예산" infra/monitoring/dashboards/predictive-alerting-dashboard.json; check "에러 예산 패널" $?

echo ""
echo "[TC-04] Design/Plan 추적성"
grep -q "Design Ref" infra/monitoring/alerts/predictive-alerts.yaml; check "알림 Design Ref" $?
grep -q "Plan SC" infra/monitoring/alerts/predictive-alerts.yaml; check "알림 Plan SC" $?

echo ""
echo "============================================"
echo " 결과: $PASS / $TOTAL PASS  ($FAIL FAIL)"
echo "============================================"
[ "$FAIL" -eq 0 ] && echo "ALL TESTS PASSED" || echo "SOME TESTS FAILED"
