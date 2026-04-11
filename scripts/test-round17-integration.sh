#!/bin/bash
# Design Ref: MTU-N243
# Plan SC: FR-PM.5
# 17라운드 통합 테스트

set -euo pipefail

PASS=0; FAIL=0; TOTAL=0
check() {
  TOTAL=$((TOTAL + 1))
  if [ "$2" = "0" ]; then echo "  [PASS] $1"; PASS=$((PASS + 1))
  else echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); fi
}

echo "============================================================"
echo " 17라운드 통합 테스트"
echo " MTU-N234 ~ MTU-N243"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"

# --- MTU-N234: Feature Flag ---
echo ""
echo "[MTU-N234] Feature Flag 플랫폼"
test -d infra/feature-flags/helm/unleash; check "Unleash Helm Chart" $?
test -d infra/feature-flags/helm/unleash-edge; check "Unleash Edge Chart" $?
test -f packages/feature-flag-sdk/src/index.ts; check "Feature Flag SDK" $?
test -f infra/monitoring/dashboards/feature-flags-dashboard.json; check "FF 대시보드" $?

# --- MTU-N235: LDAP/AD ---
echo ""
echo "[MTU-N235] LDAP/AD 연동"
test -f infra/keycloak/ldap-federation/realm-ldap-config.yaml; check "LDAP Federation 설정" $?
test -f infra/monitoring/alerts/ldap-sync-alerts.yaml; check "LDAP 동기화 알림" $?
test -f docs-portal/docs/auth/ldap-integration-guide.md; check "LDAP 가이드" $?

# --- MTU-N236: 멀티테넌트 프로비저닝 ---
echo ""
echo "[MTU-N236] 멀티테넌트 프로비저닝"
test -f scripts/tenant-provisioning/provision-tenant.sh; check "프로비저닝 스크립트" $?
test -f scripts/tenant-provisioning/deprovision-tenant.sh; check "디프로비저닝 스크립트" $?
test -f infra/keycloak/multitenant/organization-template.json; check "Organization 템플릿" $?

# --- MTU-N237: Hotfix 파이프라인 ---
echo ""
echo "[MTU-N237] Hotfix 파이프라인"
test -f .gitea/workflows/hotfix-pipeline.yaml; check "Hotfix 워크플로우" $?
test -f scripts/hotfix-deploy.sh; check "Hotfix 배포 스크립트" $?
test -f scripts/hotfix-rollback.sh; check "Hotfix 롤백 스크립트" $?

# --- MTU-N238: 변경 영향 분석 ---
echo ""
echo "[MTU-N238] 변경 영향 분석"
test -f scripts/change-impact-analysis-v2.sh; check "영향 분석 스크립트" $?
test -f infra/cicd/change-impact-rules.yaml; check "영향 분석 규칙" $?

# --- MTU-N239: 비즈니스 KPI ---
echo ""
echo "[MTU-N239] 비즈니스 KPI"
test -f infra/monitoring/rules/business-kpi-rules.yaml; check "KPI Recording Rules" $?
test -f infra/monitoring/alerts/business-kpi-alerts.yaml; check "KPI Alert Rules" $?
test -f infra/monitoring/dashboards/business-kpi-dashboard.json; check "KPI Executive 대시보드" $?
test -f scripts/generate-kpi-report.sh; check "KPI 보고서 생성기" $?

# --- MTU-N240: 공공 API 표준 ---
echo ""
echo "[MTU-N240] 공공 API 표준 검증"
test -f scripts/api-standard-validator.sh; check "API 표준 검증기" $?
test -f infra/cicd/api-standard-rules.yaml; check "API 표준 규칙" $?

# --- MTU-N241: 전자정부 호환성 ---
echo ""
echo "[MTU-N241] 전자정부 호환성"
test -f infra/compliance/egov-compatibility-checklist.yaml; check "호환성 체크리스트" $?
test -f scripts/egov-compatibility-check.sh; check "호환성 점검 스크립트" $?
test -f docs-portal/docs/compliance/egov-framework-guide.md; check "호환성 가이드" $?

# --- MTU-N242: 예측적 알림 ---
echo ""
echo "[MTU-N242] 예측적 장애 방지"
test -f infra/monitoring/alerts/predictive-alerts.yaml; check "예측 알림 규칙" $?
grep -q "predict_linear" infra/monitoring/alerts/predictive-alerts.yaml; check "predict_linear 사용" $?
test -f infra/monitoring/dashboards/predictive-alerting-dashboard.json; check "예측 대시보드" $?

# --- MTU-N243: 성숙도 평가 ---
echo ""
echo "[MTU-N243] 플랫폼 성숙도"
test -f infra/compliance/platform-maturity-model.yaml; check "성숙도 모델" $?
test -f scripts/platform-maturity-assessment.sh; check "성숙도 평가 스크립트" $?

# --- 성숙도 평가 실행 ---
echo ""
echo "[통합] 성숙도 평가 실행"
bash scripts/platform-maturity-assessment.sh > /dev/null 2>&1; check "성숙도 평가 스크립트 실행" $?

echo ""
echo "============================================================"
echo " 17라운드 통합 테스트 결과: $PASS / $TOTAL PASS  ($FAIL FAIL)"
echo "============================================================"
[ "$FAIL" -eq 0 ] && echo "ALL TESTS PASSED" || echo "SOME TESTS FAILED"
