#!/bin/bash
# Design Ref: MTU-N235
# Plan SC: FR-LDAP.1 ~ FR-LDAP.6
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0
check() {
  TOTAL=$((TOTAL + 1))
  if [ "$2" = "0" ]; then echo "  [PASS] $1"; PASS=$((PASS + 1))
  else echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); fi
}

echo "============================================"
echo " MTU-N235: LDAP/AD 연동 검증"
echo "============================================"

echo ""
echo "[TC-01] LDAP Federation 설정 파일"
test -f infra/keycloak/ldap-federation/realm-ldap-config.yaml; check "realm-ldap-config.yaml" $?
grep -q "ldaps://" infra/keycloak/ldap-federation/realm-ldap-config.yaml; check "LDAPS 프로토콜 설정" $?
grep -q "636" infra/keycloak/ldap-federation/realm-ldap-config.yaml; check "포트 636 설정" $?
grep -q "READ_ONLY" infra/keycloak/ldap-federation/realm-ldap-config.yaml; check "읽기 전용 모드" $?
grep -q "sAMAccountName" infra/keycloak/ldap-federation/realm-ldap-config.yaml; check "AD 사용자명 속성" $?

echo ""
echo "[TC-02] 속성 매핑 (공공기관 표준)"
grep -q "department" infra/keycloak/ldap-federation/realm-ldap-config.yaml; check "부서 매핑" $?
grep -q "title" infra/keycloak/ldap-federation/realm-ldap-config.yaml; check "직급 매핑" $?
grep -q "employeeNumber" infra/keycloak/ldap-federation/realm-ldap-config.yaml; check "직원번호 매핑" $?
grep -q "mail" infra/keycloak/ldap-federation/realm-ldap-config.yaml; check "이메일 매핑" $?

echo ""
echo "[TC-03] 그룹-역할 매핑"
grep -q "group-ldap-mapper" infra/keycloak/ldap-federation/realm-ldap-config.yaml; check "그룹 매퍼 설정" $?
grep -q "LOAD_GROUPS_BY_MEMBER_ATTRIBUTE" infra/keycloak/ldap-federation/realm-ldap-config.yaml; check "그룹 로드 전략" $?

echo ""
echo "[TC-04] 보안 설정"
test -f infra/keycloak/ldap-federation/sealed-secret.yaml; check "SealedSecret 템플릿" $?
grep -q "SealedSecret" infra/keycloak/ldap-federation/sealed-secret.yaml; check "SealedSecret 종류" $?
! grep -q "password:" infra/keycloak/ldap-federation/sealed-secret.yaml; check "평문 비밀번호 없음" $?

echo ""
echo "[TC-05] 모니터링"
test -f infra/monitoring/rules/ldap-sync-rules.yaml; check "Recording Rules" $?
test -f infra/monitoring/alerts/ldap-sync-alerts.yaml; check "Alert Rules" $?
grep -q "LDAPSyncFailure" infra/monitoring/alerts/ldap-sync-alerts.yaml; check "동기화 실패 알림" $?
grep -q "LDAPBindFailure" infra/monitoring/alerts/ldap-sync-alerts.yaml; check "바인드 실패 알림" $?
grep -q "LDAPConnectionPoolExhausted" infra/monitoring/alerts/ldap-sync-alerts.yaml; check "연결 풀 포화 알림" $?

echo ""
echo "[TC-06] 운영 가이드"
test -f docs-portal/docs/auth/ldap-integration-guide.md; check "LDAP 가이드 문서" $?
grep -q "LDAPS" docs-portal/docs/auth/ldap-integration-guide.md; check "LDAPS 필수 안내" $?
grep -q "트러블슈팅" docs-portal/docs/auth/ldap-integration-guide.md; check "트러블슈팅 섹션" $?
grep -q "kubeseal" docs-portal/docs/auth/ldap-integration-guide.md; check "SealedSecret 가이드" $?

echo ""
echo "[TC-07] Design/Plan 추적성"
grep -q "Design Ref" infra/keycloak/ldap-federation/realm-ldap-config.yaml; check "Config Design Ref" $?
grep -q "Plan SC" infra/keycloak/ldap-federation/realm-ldap-config.yaml; check "Config Plan SC" $?

echo ""
echo "============================================"
echo " 결과: $PASS / $TOTAL PASS  ($FAIL FAIL)"
echo "============================================"
[ "$FAIL" -eq 0 ] && echo "ALL TESTS PASSED" || echo "SOME TESTS FAILED"
