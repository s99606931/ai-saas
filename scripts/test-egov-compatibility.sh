#!/bin/bash
# Design Ref: MTU-N241
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0
check() {
  TOTAL=$((TOTAL + 1))
  if [ "$2" = "0" ]; then echo "  [PASS] $1"; PASS=$((PASS + 1))
  else echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); fi
}

echo "============================================"
echo " MTU-N241: 전자정부 호환성 검증"
echo "============================================"

echo ""
echo "[TC-01] 호환성 체크리스트"
test -f infra/compliance/egov-compatibility-checklist.yaml; check "체크리스트 파일 존재" $?
grep -q "framework_version" infra/compliance/egov-compatibility-checklist.yaml; check "프레임워크 버전 명시" $?
grep -q "execution_environment" infra/compliance/egov-compatibility-checklist.yaml; check "실행환경 카테고리" $?
grep -q "data_exchange" infra/compliance/egov-compatibility-checklist.yaml; check "데이터 교환 카테고리" $?
grep -q "security" infra/compliance/egov-compatibility-checklist.yaml; check "보안 카테고리" $?
grep -q "deployment" infra/compliance/egov-compatibility-checklist.yaml; check "배포 카테고리" $?
grep -q "compatibility_rate" infra/compliance/egov-compatibility-checklist.yaml; check "호환성 비율" $?

echo ""
echo "[TC-02] 점검 스크립트"
test -f scripts/egov-compatibility-check.sh; check "점검 스크립트 존재" $?
grep -q "EXE-001" scripts/egov-compatibility-check.sh; check "EXE-001 인증 점검" $?
grep -q "DX-001" scripts/egov-compatibility-check.sh; check "DX-001 데이터 교환 점검" $?
grep -q "SEC-" scripts/egov-compatibility-check.sh; check "보안 점검" $?
grep -q "DEP-" scripts/egov-compatibility-check.sh; check "배포 환경 점검" $?

echo ""
echo "[TC-03] 가이드 문서"
test -f docs-portal/docs/compliance/egov-framework-guide.md; check "가이드 문서 존재" $?
grep -q "호환성 매핑" docs-portal/docs/compliance/egov-framework-guide.md; check "호환성 매핑 테이블" $?
grep -q "마이그레이션" docs-portal/docs/compliance/egov-framework-guide.md; check "마이그레이션 가이드" $?
grep -q "제한사항" docs-portal/docs/compliance/egov-framework-guide.md; check "제한사항 안내" $?

echo ""
echo "[TC-04] 실행 테스트"
bash scripts/egov-compatibility-check.sh > /dev/null 2>&1; check "점검 스크립트 실행 성공" $?

echo ""
echo "[TC-05] Design/Plan 추적성"
grep -q "Design Ref" infra/compliance/egov-compatibility-checklist.yaml; check "체크리스트 Design Ref" $?
grep -q "Plan SC" scripts/egov-compatibility-check.sh; check "스크립트 Plan SC" $?

echo ""
echo "============================================"
echo " 결과: $PASS / $TOTAL PASS  ($FAIL FAIL)"
echo "============================================"
[ "$FAIL" -eq 0 ] && echo "ALL TESTS PASSED" || echo "SOME TESTS FAILED"
