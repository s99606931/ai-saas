#!/usr/bin/env bash
# Plan SC: FR-N84.1 ~ FR-N84.6
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0; RESULTS=""
pass_test() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); RESULTS="${RESULTS}\n  [PASS] $1"; }
fail_test() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); RESULTS="${RESULTS}\n  [FAIL] $1: $2"; }

echo "============================================"
echo " MTU-N84: CSAP 증거 자동 수집 E2E"
echo "============================================"

# T01: CronJob
echo "[T01] CronJob 검증..."
F="/data/ai-saas/infra/compliance/evidence-collector/cronjob.yaml"
if [ -f "$F" ] && grep -q "CronJob" "$F" && grep -q "csap-evidence-collector" "$F" && grep -q "ClusterRole" "$F"; then
  pass_test "T01: CronJob + RBAC (CSAP 전 통제영역 접근)"
else fail_test "T01: CronJob" "설정 누락"; fi

# T02: 증거 매핑
echo "[T02] 증거 매핑 검증..."
F="/data/ai-saas/infra/compliance/evidence-collector/evidence-map.yaml"
if [ -f "$F" ]; then
  C=0
  grep -q "D-06:" "$F" && C=$((C+1))
  grep -q "D-08:" "$F" && C=$((C+1))
  grep -q "D-09:" "$F" && C=$((C+1))
  grep -q "D-12:" "$F" && C=$((C+1))
  grep -q "D-13:" "$F" && C=$((C+1))
  grep -q "total_controls: 79" "$F" && C=$((C+1))
  [ "$C" -ge 5 ] && pass_test "T02: 증거 매핑 (${C}/6 통제영역)" || fail_test "T02: 증거 매핑" "${C}/6"
else fail_test "T02: 증거 매핑" "파일 없음"; fi

# T03: 수집 스크립트
echo "[T03] 수집 스크립트 검증..."
F="/data/ai-saas/scripts/csap-evidence-collect.sh"
if [ -f "$F" ] && grep -q "sha256sum" "$F" && grep -q "manifest.json" "$F" && grep -q "integrity.sha256" "$F"; then
  pass_test "T03: 수집 스크립트 (해시 + 매니페스트)"
else fail_test "T03: 수집 스크립트" "필수 기능 누락"; fi

# T04: 검증 스크립트
echo "[T04] 검증 스크립트 검증..."
F="/data/ai-saas/scripts/csap-evidence-verify.sh"
if [ -f "$F" ] && grep -q "sha256sum" "$F" && grep -q "manifest.json" "$F"; then
  pass_test "T04: 검증 스크립트 (무결성 + 완전성)"
else fail_test "T04: 검증 스크립트" "필수 기능 누락"; fi

# T05: 수집 실행 테스트
echo "[T05] 증거 수집 실행 테스트..."
chmod +x /data/ai-saas/scripts/csap-evidence-collect.sh
bash /data/ai-saas/scripts/csap-evidence-collect.sh "test-run" >/dev/null 2>&1
if [ -f "/data/ai-saas/evidence/test-run/manifest.json" ] && [ -f "/data/ai-saas/evidence/test-run/integrity.sha256" ]; then
  pass_test "T05: 증거 수집 실행 (매니페스트 + 해시 생성)"
  rm -rf /data/ai-saas/evidence/test-run  # 정리
else
  fail_test "T05: 증거 수집 실행" "산출물 부족"
  rm -rf /data/ai-saas/evidence/test-run 2>/dev/null || true
fi

# T06: YAML 문법
echo "[T06] YAML 문법 검증..."
OK=0; TOT=0
for f in /data/ai-saas/infra/compliance/evidence-collector/*.yaml; do
  TOT=$((TOT+1))
  python3 -c "import yaml; list(yaml.safe_load_all(open('$f')))" 2>/dev/null && OK=$((OK+1))
done
[ "$OK" -eq "$TOT" ] && pass_test "T06: YAML 문법 (${OK}/${TOT})" || fail_test "T06: YAML" "${OK}/${TOT}"

# T07: 시크릿 검사
echo "[T07] 시크릿 하드코딩 검사..."
SEC=0
for f in /data/ai-saas/infra/compliance/evidence-collector/*.yaml; do
  grep -iE "(password|api.?key)\s*[:=]\s*['\"]?[a-zA-Z0-9]{8}" "$f" 2>/dev/null | grep -v "secretKeyRef\|automountServiceAccountToken" | grep -q . && SEC=$((SEC+1))
done
[ "$SEC" -eq 0 ] && pass_test "T07: 시크릿 하드코딩 없음" || fail_test "T07: 시크릿" "${SEC}개"

echo ""
echo "============================================"
echo " MTU-N84 E2E 테스트 결과"
echo "============================================"
echo -e "$RESULTS"
echo " 통과: ${PASS}/${TOTAL} | 실패: ${FAIL}/${TOTAL}"
[ "$FAIL" -gt 0 ] && { echo " [WARNING] 실패"; exit 1; } || { echo " [SUCCESS] 모든 테스트 통과"; exit 0; }
