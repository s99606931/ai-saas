#!/usr/bin/env bash
# Design Ref: MTU-N80 전체
# Plan SC: FR-N80.1 ~ FR-N80.7
set -euo pipefail

PASS=0
FAIL=0
TOTAL=0
RESULTS=""

pass_test() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); RESULTS="${RESULTS}\n  [PASS] $1"; }
fail_test() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); RESULTS="${RESULTS}\n  [FAIL] $1: $2"; }

echo "============================================"
echo " MTU-N80: S2C2F 공급망 소비 프레임워크 E2E"
echo "============================================"

# T01: S2C2F 정책 문서
echo "[T01] S2C2F 정책 문서 검증..."
F="/data/ai-saas/infra/security/s2c2f/policy.yaml"
if [ -f "$F" ] && grep -q "S2C2F" "$F" && grep -q "Level 3" "$F" && grep -q "practices:" "$F"; then
  pass_test "T01: S2C2F 정책 문서 (8대 실천항목)"
else
  fail_test "T01: S2C2F 정책 문서" "필수 항목 누락"
fi

# T02: Kyverno 정책
echo "[T02] Kyverno 정책 검증..."
F="/data/ai-saas/infra/security/s2c2f/kyverno-policies.yaml"
if [ -f "$F" ]; then
  C=0
  grep -q "ClusterPolicy" "$F" && C=$((C+1))
  grep -q "allowed-registries" "$F" && C=$((C+1))
  grep -q "digest-pinning" "$F" && C=$((C+1))
  grep -q "sbom-attestation" "$F" && C=$((C+1))
  grep -q "vulnerability-gate" "$F" && C=$((C+1))
  [ "$C" -ge 4 ] && pass_test "T02: Kyverno 정책 (${C}/5 항목)" || fail_test "T02: Kyverno 정책" "${C}/5 통과"
else
  fail_test "T02: Kyverno 정책" "파일 없음"
fi

# T03: 라이선스 검사
echo "[T03] 라이선스 검사 설정 검증..."
F="/data/ai-saas/infra/security/s2c2f/license-check.yaml"
if [ -f "$F" ] && grep -q "allowed:" "$F" && grep -q "prohibited:" "$F" && grep -q "AGPL" "$F"; then
  pass_test "T03: 라이선스 검사 (허용/금지 목록)"
else
  fail_test "T03: 라이선스 검사" "필수 항목 누락"
fi

# T04: 성숙도 평가 스크립트
echo "[T04] 성숙도 평가 스크립트 검증..."
F="/data/ai-saas/scripts/s2c2f-assessment.sh"
if [ -f "$F" ] && grep -q "S2C2F" "$F" && grep -q "Level 3" "$F"; then
  pass_test "T04: S2C2F 성숙도 평가 스크립트"
else
  fail_test "T04: 성숙도 평가 스크립트" "파일 없음 또는 내용 부족"
fi

# T05: 성숙도 평가 실행
echo "[T05] 성숙도 평가 실행..."
if bash /data/ai-saas/scripts/s2c2f-assessment.sh 2>/dev/null | grep -q "점수:"; then
  pass_test "T05: S2C2F 성숙도 평가 실행 성공"
else
  fail_test "T05: 성숙도 평가 실행" "실행 실패"
fi

# T06: YAML 문법
echo "[T06] YAML 문법 검증..."
OK=0; TOT=0
for f in /data/ai-saas/infra/security/s2c2f/*.yaml; do
  TOT=$((TOT+1))
  python3 -c "import yaml; list(yaml.safe_load_all(open('$f')))" 2>/dev/null && OK=$((OK+1))
done
[ "$OK" -eq "$TOT" ] && pass_test "T06: YAML 문법 (${OK}/${TOT})" || fail_test "T06: YAML 문법" "${OK}/${TOT}"

# T07: 시크릿 검사
echo "[T07] 시크릿 하드코딩 검사..."
SEC=0
for f in /data/ai-saas/infra/security/s2c2f/*.yaml; do
  grep -iE "(password|api.?key)\s*[:=]\s*['\"]?[a-zA-Z0-9]{8}" "$f" 2>/dev/null | grep -v "secretKeyRef" | grep -q . && SEC=$((SEC+1))
done
[ "$SEC" -eq 0 ] && pass_test "T07: 시크릿 하드코딩 없음" || fail_test "T07: 시크릿" "${SEC}개 발견"

echo ""
echo "============================================"
echo " MTU-N80 E2E 테스트 결과"
echo "============================================"
echo -e "$RESULTS"
echo ""
echo " 통과: ${PASS}/${TOTAL} | 실패: ${FAIL}/${TOTAL}"
[ "$FAIL" -gt 0 ] && { echo " [WARNING] 일부 테스트 실패"; exit 1; } || { echo " [SUCCESS] 모든 테스트 통과"; exit 0; }
