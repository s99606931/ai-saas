#!/bin/bash
# ============================================================
# MTU-N75: Admission Webhook 커스텀 보안 검증기 테스트
# Plan SC: FR-N75.6
# ============================================================

set -euo pipefail

PASS=0
FAIL=0
TOTAL=12

log_pass() { echo "  [PASS] $1"; PASS=$((PASS+1)); }
log_fail() { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }

echo "============================================================"
echo "MTU-N75: Admission Webhook 보안 검증기 테스트"
echo "날짜: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
echo ""

BASE=/data/ai-saas/infra/kyverno/policies/admission-security

# AW-01: 이미지 레지스트리 화이트리스트 정책 존재
echo "[AW-01] 이미지 레지스트리 화이트리스트 정책 확인"
if [ -f "$BASE/image-registry-whitelist.yaml" ] && grep -q 'restrict-image-registries' "$BASE/image-registry-whitelist.yaml"; then
  log_pass "이미지 레지스트리 화이트리스트 정책 존재"
else
  log_fail "이미지 화이트리스트 정책 미존재"
fi

# AW-02: Enforce 모드 확인
echo "[AW-02] 이미지 정책 Enforce 모드 확인"
if grep -q 'validationFailureAction: Enforce' "$BASE/image-registry-whitelist.yaml" 2>/dev/null; then
  log_pass "이미지 정책 Enforce 모드 설정"
else
  log_fail "이미지 정책 Enforce 미설정"
fi

# AW-03: Harbor 레지스트리 허용 확인
echo "[AW-03] Harbor 레지스트리 허용 확인"
if grep -q 'harbor.saas.internal' "$BASE/image-registry-whitelist.yaml" 2>/dev/null; then
  log_pass "Harbor 레지스트리 허용됨"
else
  log_fail "Harbor 레지스트리 미허용"
fi

# AW-04: 필수 라벨 정책 존재
echo "[AW-04] 필수 라벨 강제 정책 확인"
if [ -f "$BASE/require-labels.yaml" ] && grep -q 'require-labels' "$BASE/require-labels.yaml"; then
  log_pass "필수 라벨 정책 존재"
else
  log_fail "필수 라벨 정책 미존재"
fi

# AW-05: 3개 필수 라벨 정의
echo "[AW-05] 3개 필수 라벨 정의 확인"
LABEL_COUNT=0
grep -q 'app.kubernetes.io/name' "$BASE/require-labels.yaml" 2>/dev/null && LABEL_COUNT=$((LABEL_COUNT+1))
grep -q 'app.kubernetes.io/component' "$BASE/require-labels.yaml" 2>/dev/null && LABEL_COUNT=$((LABEL_COUNT+1))
grep -q 'team' "$BASE/require-labels.yaml" 2>/dev/null && LABEL_COUNT=$((LABEL_COUNT+1))
if [ "$LABEL_COUNT" -eq 3 ]; then
  log_pass "3개 필수 라벨 정의됨"
else
  log_fail "필수 라벨 부족 (${LABEL_COUNT}/3)"
fi

# AW-06: 리소스 기본값 주입 정책
echo "[AW-06] 리소스 기본값 Mutation 정책 확인"
if [ -f "$BASE/default-resources.yaml" ] && grep -q 'mutate' "$BASE/default-resources.yaml"; then
  log_pass "리소스 기본값 Mutation 정책 존재"
else
  log_fail "리소스 기본값 Mutation 미존재"
fi

# AW-07: CPU/Memory 기본값 확인
echo "[AW-07] CPU/Memory 기본값 확인"
if grep -q '50m' "$BASE/default-resources.yaml" && grep -q '64Mi' "$BASE/default-resources.yaml"; then
  log_pass "CPU 50m, Memory 64Mi 기본값 설정"
else
  log_fail "기본값 미설정"
fi

# AW-08: 시크릿 환경변수 금지 정책
echo "[AW-08] 시크릿 환경변수 금지 정책 확인"
if [ -f "$BASE/deny-secret-env.yaml" ] && grep -q 'deny-secret-in-env' "$BASE/deny-secret-env.yaml"; then
  log_pass "시크릿 환경변수 금지 정책 존재"
else
  log_fail "시크릿 금지 정책 미존재"
fi

# AW-09: 시크릿 패턴 검사 (SECRET, PASSWORD, API_KEY, TOKEN)
echo "[AW-09] 시크릿 키워드 패턴 확인"
KW_COUNT=0
grep -q 'SECRET' "$BASE/deny-secret-env.yaml" 2>/dev/null && KW_COUNT=$((KW_COUNT+1))
grep -q 'PASSWORD' "$BASE/deny-secret-env.yaml" 2>/dev/null && KW_COUNT=$((KW_COUNT+1))
grep -q 'API_KEY' "$BASE/deny-secret-env.yaml" 2>/dev/null && KW_COUNT=$((KW_COUNT+1))
grep -q 'TOKEN' "$BASE/deny-secret-env.yaml" 2>/dev/null && KW_COUNT=$((KW_COUNT+1))
if [ "$KW_COUNT" -ge 4 ]; then
  log_pass "시크릿 키워드 ${KW_COUNT}개 패턴 검사"
else
  log_fail "시크릿 키워드 부족 (${KW_COUNT}/4)"
fi

# AW-10: 감사 로깅 정책 존재
echo "[AW-10] Admission 감사 로깅 정책 확인"
if grep -q 'admission-audit-log' "$BASE/deny-secret-env.yaml" 2>/dev/null; then
  log_pass "Admission 감사 로깅 정책 존재"
else
  log_fail "Admission 감사 로깅 미존재"
fi

# AW-11: CSAP 매핑 확인 (D-08, D-09, D-12)
echo "[AW-11] CSAP 매핑 확인 (D-08, D-09, D-12)"
CSAP_COUNT=0
find "$BASE" -name "*.yaml" -exec grep -l 'D-08' {} \; 2>/dev/null | head -1 | grep -q . && CSAP_COUNT=$((CSAP_COUNT+1))
find "$BASE" -name "*.yaml" -exec grep -l 'D-09' {} \; 2>/dev/null | head -1 | grep -q . && CSAP_COUNT=$((CSAP_COUNT+1))
find "$BASE" -name "*.yaml" -exec grep -l 'D-12' {} \; 2>/dev/null | head -1 | grep -q . && CSAP_COUNT=$((CSAP_COUNT+1))
if [ "$CSAP_COUNT" -ge 3 ]; then
  log_pass "CSAP D-08, D-09, D-12 매핑 확인"
else
  log_fail "CSAP 매핑 부족 (${CSAP_COUNT}/3)"
fi

# AW-12: kube-system 예외 처리
echo "[AW-12] kube-system 예외 처리 확인"
EXCLUDE_COUNT=$(grep -rl 'kube-system' "$BASE/" 2>/dev/null | wc -l || echo 0)
if [ "$EXCLUDE_COUNT" -ge 3 ]; then
  log_pass "kube-system 예외 ${EXCLUDE_COUNT}개 정책에 적용"
else
  log_fail "kube-system 예외 부족 (${EXCLUDE_COUNT}개 정책)"
fi

echo ""
echo "============================================================"
echo "MTU-N75 Admission Webhook 검증 결과"
echo "============================================================"
echo "  통과: ${PASS} / ${TOTAL}"
echo "  실패: ${FAIL} / ${TOTAL}"
echo "  매치율: $(( PASS * 100 / TOTAL ))%"
echo "============================================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
