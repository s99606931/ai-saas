#!/bin/bash
# Design Ref: MTU-N238
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0
check() {
  TOTAL=$((TOTAL + 1))
  if [ "$2" = "0" ]; then echo "  [PASS] $1"; PASS=$((PASS + 1))
  else echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); fi
}

echo "============================================"
echo " MTU-N238: 변경 영향 분석 검증"
echo "============================================"

echo ""
echo "[TC-01] 분석 스크립트"
test -f scripts/change-impact-analysis-v2.sh; check "분석 스크립트 존재" $?
grep -q "RISK_LEVEL" scripts/change-impact-analysis-v2.sh; check "위험도 판정 로직" $?
grep -q "SECURITY_ALERT" scripts/change-impact-analysis-v2.sh; check "보안 파일 감지" $?
grep -q "classify_file" scripts/change-impact-analysis-v2.sh; check "파일 분류 함수" $?
grep -q "json" scripts/change-impact-analysis-v2.sh; check "JSON 출력 지원" $?

echo ""
echo "[TC-02] 위험도 규칙 파일"
test -f infra/cicd/change-impact-rules.yaml; check "규칙 파일 존재" $?
grep -q "security:" infra/cicd/change-impact-rules.yaml; check "보안 카테고리" $?
grep -q "infrastructure:" infra/cicd/change-impact-rules.yaml; check "인프라 카테고리" $?
grep -q "database:" infra/cicd/change-impact-rules.yaml; check "DB 카테고리" $?
grep -q "risk_levels:" infra/cicd/change-impact-rules.yaml; check "위험도 레벨 정의" $?
grep -q "critical_files:" infra/cicd/change-impact-rules.yaml; check "Critical 파일 정의" $?

echo ""
echo "[TC-03] 가중치 검증"
grep -q "weight: 5" infra/cicd/change-impact-rules.yaml; check "보안 가중치 5" $?
grep -q "weight: 4" infra/cicd/change-impact-rules.yaml; check "인프라/DB 가중치 4" $?
grep -q "weight: 3" infra/cicd/change-impact-rules.yaml; check "API 가중치 3" $?
grep -q "weight: 0" infra/cicd/change-impact-rules.yaml; check "문서 가중치 0" $?

echo ""
echo "[TC-04] 실행 테스트"
bash scripts/change-impact-analysis-v2.sh main HEAD text > /dev/null 2>&1; check "스크립트 실행 성공" $?
bash scripts/change-impact-analysis-v2.sh main HEAD json 2>/dev/null | grep -q "riskLevel"; check "JSON 출력 동작" $?

echo ""
echo "[TC-05] Design/Plan 추적성"
grep -q "Design Ref" scripts/change-impact-analysis-v2.sh; check "스크립트 Design Ref" $?
grep -q "Plan SC" scripts/change-impact-analysis-v2.sh; check "스크립트 Plan SC" $?
grep -q "Design Ref" infra/cicd/change-impact-rules.yaml; check "규칙 Design Ref" $?

echo ""
echo "============================================"
echo " 결과: $PASS / $TOTAL PASS  ($FAIL FAIL)"
echo "============================================"
[ "$FAIL" -eq 0 ] && echo "ALL TESTS PASSED" || echo "SOME TESTS FAILED"
