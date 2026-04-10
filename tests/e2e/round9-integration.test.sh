#!/bin/bash
# 9라운드 통합검증 테스트
# Plan SC: FR-N112.1~FR-N112.4

set -uo pipefail
PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "[FAIL] $1: $2"; }

echo "============================================================"
echo " MTU-N112: 9라운드 통합검증 (N105~N111)"
echo "============================================================"
echo ""

# === FR-N112.1: 전체 E2E 테스트 일괄 실행 ===
echo "=== FR-N112.1: 전체 E2E 테스트 재실행 ==="
echo ""

TESTS=(
  "tests/e2e/sonarqube-integration.test.sh:MTU-N105"
  "tests/e2e/api-doc-autogen.test.sh:MTU-N106"
  "tests/e2e/aiops-multivariate.test.sh:MTU-N107"
  "tests/e2e/multitenant-cicd.test.sh:MTU-N108"
  "tests/e2e/predictive-scaling-v2.test.sh:MTU-N109"
  "tests/e2e/finops-budget-alert.test.sh:MTU-N110"
  "tests/e2e/arch-diagram-auto.test.sh:MTU-N111"
)

for test_entry in "${TESTS[@]}"; do
  IFS=':' read -r test_file mtu_id <<< "$test_entry"
  echo "--- ${mtu_id} E2E 재실행 ---"
  if bash "/data/ai-saas/${test_file}" > /dev/null 2>&1; then
    pass "${mtu_id} E2E 테스트 통과"
  else
    fail "${mtu_id} E2E 테스트 실패" "${test_file}"
  fi
done

# === FR-N112.2: 크로스 의존성 검증 ===
echo ""
echo "=== FR-N112.2: 크로스 의존성 검증 ==="
echo ""

# N107(다변량) <-> N109(예측) 특성 벡터 호환성
echo "--- N107 <-> N109 특성 벡터 호환성 ---"
N107_FEATURES=$(grep -c "query:" /data/ai-saas/infra/anomaly-detection/multivariate-config.yaml || true)
N109_FEATURES=$(grep -c "query:" /data/ai-saas/infra/predictive-scaling/xgboost-ensemble.yaml || true)
if [ "$N107_FEATURES" -ge 5 ] && [ "$N109_FEATURES" -ge 5 ]; then
  pass "N107/N109 특성 벡터 충분 (N107:$N107_FEATURES, N109:$N109_FEATURES)"
else
  fail "특성 벡터 부족" "N107:$N107_FEATURES, N109:$N109_FEATURES"
fi

# Prometheus URL 공유
if grep -q "prometheus-server.monitoring" /data/ai-saas/infra/anomaly-detection/multivariate-config.yaml && \
   grep -q "prometheus-server.monitoring" /data/ai-saas/infra/predictive-scaling/training-cronjob.yaml; then
  pass "N107/N109 Prometheus URL 일관성"
else
  fail "Prometheus URL 불일치" ""
fi

# N110(FinOps) <-> N109(예측) Prometheus 연동
if grep -q "prometheus" /data/ai-saas/infra/finops/cost-prediction-config.yaml; then
  pass "N110 FinOps -> Prometheus 연동 확인"
else
  fail "N110 Prometheus 미연동" ""
fi

# N105(SonarQube) <-> N106(API문서) 코드 품질 연동
if [ -f "/data/ai-saas/sonar-project.properties" ] && [ -f "/data/ai-saas/docs-portal/static/openapi/ai-saas-api.yaml" ]; then
  pass "N105/N106 코드 품질 + API 문서 동시 운영 가능"
else
  fail "N105/N106 연동 불완전" ""
fi

# N108(멀티테넌트) <-> N110(예산) 테넌트 티어 일관성
if grep -q "basic" /data/ai-saas/infra/multi-tenant-cicd/tenant-quota-template.yaml && \
   grep -q "basic" /data/ai-saas/infra/finops/budget-policy.yaml; then
  pass "N108/N110 테넌트 티어 일관성"
else
  fail "티어 정의 불일치" ""
fi

# === FR-N112.3: Q-Gate G1~G7 확인 ===
echo ""
echo "=== FR-N112.3: Q-Gate G1~G7 전수 확인 ==="
echo ""

# G1: FR ID 전수
for mtu in N105 N106 N107 N108 N109 N110 N111; do
  PLAN_FILE=$(find /data/ai-saas/docs/01-plan/mtus/ -name "MTU-${mtu}*plan.md" -o -name "MTU-${mtu}*plan.md" 2>/dev/null | head -1)
  if [ -n "$PLAN_FILE" ] && grep -q "FR-${mtu}" "$PLAN_FILE"; then
    pass "G1: ${mtu} FR ID 존재"
  else
    fail "G1: ${mtu} FR ID 누락" ""
  fi
done

# G2: 설계 완전성
for mtu in N105 N106 N107 N108 N109 N110 N111; do
  DESIGN_FILE=$(find /data/ai-saas/docs/02-design/mtus/ -name "MTU-${mtu}*design.md" 2>/dev/null | head -1)
  if [ -n "$DESIGN_FILE" ] && [ -f "$DESIGN_FILE" ]; then
    pass "G2: ${mtu} Design 문서 존재"
  else
    fail "G2: ${mtu} Design 문서 누락" ""
  fi
done

# G5: 시크릿 하드코딩 검사
HARDCODED=$(grep -rE "(password|secret|api_key)\s*[:=]\s*['\"][a-zA-Z0-9]{10}" \
  /data/ai-saas/infra/sonarqube/ \
  /data/ai-saas/infra/anomaly-detection/multivariate-config.yaml \
  /data/ai-saas/infra/multi-tenant-cicd/ \
  /data/ai-saas/infra/predictive-scaling/ \
  /data/ai-saas/infra/finops/ \
  2>/dev/null | grep -v "secrets\." | grep -v "kind:" || true)
if [ -z "$HARDCODED" ]; then
  pass "G5: 시크릿 하드코딩 없음 (OWASP A02)"
else
  fail "G5: 시크릿 하드코딩 발견" "$HARDCODED"
fi

# G7: 감사 로그 확인
if [ -f "/data/ai-saas/.claude/audit.jsonl" ]; then
  pass "G7: audit.jsonl 존재"
else
  fail "G7: audit.jsonl 누락" ""
fi

# === FR-N112.4: 산출물 완전성 ===
echo ""
echo "=== FR-N112.4: 산출물 완전성 검증 ==="
echo ""

ARCHIVE_BASE="/data/ai-saas/docs/archive/2026-04"
for mtu in MTU-N105-sonarqube-quality-gate MTU-N106-api-doc-autogen MTU-N107-aiops-multivariate \
           MTU-N108-multitenant-cicd MTU-N109-predictive-scaling-v2 MTU-N110-finops-budget-alert \
           MTU-N111-arch-diagram-auto; do
  if [ -d "${ARCHIVE_BASE}/${mtu}" ]; then
    pass "아카이브: ${mtu}"
  else
    fail "아카이브 누락" "${mtu}"
  fi
done

# Report 파일 존재 확인
for n in N105 N106 N107 N108 N109 N110 N111; do
  REPORT=$(find "${ARCHIVE_BASE}" -name "MTU-${n}.report.md" 2>/dev/null | head -1)
  if [ -n "$REPORT" ] && [ -f "$REPORT" ]; then
    pass "Report: ${n}"
  else
    fail "Report 누락" "${n}"
  fi
done

# 최종 결과
echo ""
echo "============================================================"
echo " 9라운드 통합검증 최종 결과"
echo "============================================================"
echo " 통과: ${PASS}/${TOTAL} (실패: ${FAIL})"
echo "============================================================"

if [ $FAIL -gt 0 ]; then
  exit 1
fi

MATCH_RATE=$(echo "scale=1; $PASS * 100 / $TOTAL" | bc)
echo "matchRate: ${MATCH_RATE}%"
echo "[PASS] 9라운드 통합검증 전수 통과"
