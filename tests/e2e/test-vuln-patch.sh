#!/usr/bin/env bash
# Plan SC: FR-N81.1 ~ FR-N81.6
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0; RESULTS=""
pass_test() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); RESULTS="${RESULTS}\n  [PASS] $1"; }
fail_test() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); RESULTS="${RESULTS}\n  [FAIL] $1: $2"; }

echo "============================================"
echo " MTU-N81: 취약점 자동 패치 파이프라인 E2E"
echo "============================================"

# T01: 워크플로우 정의
F="/data/ai-saas/infra/security/vuln-patch/workflow.yaml"
echo "[T01] 워크플로우 검증..."
if [ -f "$F" ] && grep -q "stages:" "$F" && grep -q "rebuild" "$F" && grep -q "verify" "$F" && grep -q "audit" "$F"; then
  pass_test "T01: 워크플로우 (detect→assess→rebuild→verify→deploy→audit)"
else fail_test "T01: 워크플로우" "필수 단계 누락"; fi

# T02: 에스컬레이션 정책
F="/data/ai-saas/infra/security/vuln-patch/escalation-policy.yaml"
echo "[T02] 에스컬레이션 정책 검증..."
if [ -f "$F" ] && grep -q "critical:" "$F" && grep -q "mttr_target" "$F" && grep -q "zero_day" "$F"; then
  pass_test "T02: 에스컬레이션 정책 (SLA + 제로데이)"
else fail_test "T02: 에스컬레이션 정책" "필수 항목 누락"; fi

# T03: 리빌드 트리거
F="/data/ai-saas/infra/security/vuln-patch/rebuild-trigger.yaml"
echo "[T03] 리빌드 트리거 검증..."
if [ -f "$F" ] && grep -q "CronJob" "$F" && grep -q "vulnerabilityreports" "$F" && grep -q "ServiceAccount" "$F"; then
  pass_test "T03: 리빌드 트리거 CronJob (RBAC 포함)"
else fail_test "T03: 리빌드 트리거" "필수 리소스 누락"; fi

# T04: 알림 규칙
F="/data/ai-saas/infra/security/vuln-patch/alerting-rules.yaml"
echo "[T04] 알림 규칙 검증..."
if [ -f "$F" ]; then
  C=0
  grep -q "CriticalCVEDetected" "$F" && C=$((C+1))
  grep -q "HighCVEDetected" "$F" && C=$((C+1))
  grep -q "SLABreach" "$F" && C=$((C+1))
  grep -q "PipelineFailure" "$F" && C=$((C+1))
  [ "$C" -ge 3 ] && pass_test "T04: 알림 규칙 (${C}/4 유형)" || fail_test "T04: 알림 규칙" "${C}/4"
else fail_test "T04: 알림 규칙" "파일 없음"; fi

# T05: YAML 문법
echo "[T05] YAML 문법 검증..."
OK=0; TOT=0
for f in /data/ai-saas/infra/security/vuln-patch/*.yaml; do
  TOT=$((TOT+1))
  python3 -c "import yaml; list(yaml.safe_load_all(open('$f')))" 2>/dev/null && OK=$((OK+1))
done
[ "$OK" -eq "$TOT" ] && pass_test "T05: YAML 문법 (${OK}/${TOT})" || fail_test "T05: YAML" "${OK}/${TOT}"

# T06: CSAP D-06/D-12 라벨
echo "[T06] CSAP 라벨 검증..."
C=0
for f in /data/ai-saas/infra/security/vuln-patch/*.yaml; do
  grep -q "csap.compliance/control" "$f" && C=$((C+1))
done
[ "$C" -ge 3 ] && pass_test "T06: CSAP 라벨 (${C}개 파일)" || fail_test "T06: CSAP 라벨" "${C}개만"

# T07: 시크릿 검사
echo "[T07] 시크릿 하드코딩 검사..."
SEC=0
for f in /data/ai-saas/infra/security/vuln-patch/*.yaml; do
  grep -iE "(password|api.?key)\s*[:=]\s*['\"]?[a-zA-Z0-9]{8}" "$f" 2>/dev/null | grep -v "secretKeyRef\|ValueFrom\|configMapKeyRef" | grep -q . && SEC=$((SEC+1))
done
[ "$SEC" -eq 0 ] && pass_test "T07: 시크릿 하드코딩 없음" || fail_test "T07: 시크릿" "${SEC}개"

echo ""
echo "============================================"
echo " MTU-N81 E2E 테스트 결과"
echo "============================================"
echo -e "$RESULTS"
echo " 통과: ${PASS}/${TOTAL} | 실패: ${FAIL}/${TOTAL}"
[ "$FAIL" -gt 0 ] && { echo " [WARNING] 실패"; exit 1; } || { echo " [SUCCESS] 모든 테스트 통과"; exit 0; }
