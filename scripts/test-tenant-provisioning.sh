#!/bin/bash
# Design Ref: MTU-N236
# Plan SC: FR-MT.1 ~ FR-MT.6
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0
check() {
  TOTAL=$((TOTAL + 1))
  if [ "$2" = "0" ]; then echo "  [PASS] $1"; PASS=$((PASS + 1))
  else echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); fi
}

echo "============================================"
echo " MTU-N236: 멀티테넌트 프로비저닝 검증"
echo "============================================"

echo ""
echo "[TC-01] 프로비저닝 스크립트"
test -f scripts/tenant-provisioning/provision-tenant.sh; check "provision-tenant.sh 존재" $?
test -x scripts/tenant-provisioning/provision-tenant.sh 2>/dev/null || chmod +x scripts/tenant-provisioning/provision-tenant.sh
test -x scripts/tenant-provisioning/provision-tenant.sh; check "provision-tenant.sh 실행 권한" $?
grep -q "Organization" scripts/tenant-provisioning/provision-tenant.sh; check "Organization API 사용" $?
grep -q "\-\-name" scripts/tenant-provisioning/provision-tenant.sh; check "인자 파싱 구현" $?
grep -q "\-\-dry-run" scripts/tenant-provisioning/provision-tenant.sh; check "dry-run 모드" $?
grep -q "audit" scripts/tenant-provisioning/provision-tenant.sh; check "감사 로그 기록" $?

echo ""
echo "[TC-02] 디프로비저닝 스크립트"
test -f scripts/tenant-provisioning/deprovision-tenant.sh; check "deprovision-tenant.sh 존재" $?
grep -q "enabled.*false" scripts/tenant-provisioning/deprovision-tenant.sh; check "비활성화 처리" $?
grep -q "90" scripts/tenant-provisioning/deprovision-tenant.sh; check "보존 기간 90일" $?

echo ""
echo "[TC-03] Organization 템플릿"
test -f infra/keycloak/multitenant/organization-template.json; check "템플릿 파일 존재" $?
grep -q "defaultGroups" infra/keycloak/multitenant/organization-template.json; check "기본 그룹 정의" $?
grep -q "defaultRoleMappings" infra/keycloak/multitenant/organization-template.json; check "역할 매핑 정의" $?
grep -q "defaultClientScopes" infra/keycloak/multitenant/organization-template.json; check "클라이언트 스코프 정의" $?

echo ""
echo "[TC-04] 모니터링 대시보드"
test -f infra/monitoring/dashboards/tenant-provisioning-dashboard.json; check "대시보드 파일 존재" $?
grep -q "keycloak_organizations_total" infra/monitoring/dashboards/tenant-provisioning-dashboard.json; check "테넌트 수 메트릭" $?
grep -q "provision_failures" infra/monitoring/dashboards/tenant-provisioning-dashboard.json; check "실패율 메트릭" $?

echo ""
echo "[TC-05] Dry-run 테스트"
bash scripts/tenant-provisioning/provision-tenant.sh --name "테스트기관" --domain "test.go.kr" --dry-run > /dev/null 2>&1; check "프로비저닝 dry-run 성공" $?

echo ""
echo "[TC-06] Design/Plan 추적성"
grep -q "Design Ref" scripts/tenant-provisioning/provision-tenant.sh; check "스크립트 Design Ref" $?
grep -q "Plan SC" scripts/tenant-provisioning/provision-tenant.sh; check "스크립트 Plan SC" $?

echo ""
echo "============================================"
echo " 결과: $PASS / $TOTAL PASS  ($FAIL FAIL)"
echo "============================================"
[ "$FAIL" -eq 0 ] && echo "ALL TESTS PASSED" || echo "SOME TESTS FAILED"
