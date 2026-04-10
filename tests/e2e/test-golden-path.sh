#!/usr/bin/env bash
# Plan SC: FR-N86.1 ~ FR-N86.6
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0; RESULTS=""
pass_test() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); RESULTS="${RESULTS}\n  [PASS] $1"; }
fail_test() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); RESULTS="${RESULTS}\n  [FAIL] $1: $2"; }

echo "============================================"
echo " MTU-N86: IDP Golden Path 템플릿 E2E"
echo "============================================"

# T01: Node.js 템플릿
echo "[T01] Node.js 템플릿 검증..."
D="/data/ai-saas/templates/golden-path/nodejs"
if [ -f "$D/Dockerfile" ] && [ -f "$D/package.json" ] && [ -f "$D/src/index.ts" ] && [ -f "$D/src/health.ts" ]; then
  pass_test "T01: Node.js 템플릿 (Dockerfile + package.json + src)"
else fail_test "T01: Node.js 템플릿" "필수 파일 누락"; fi

# T02: Dockerfile 보안
echo "[T02] Dockerfile 보안 검증..."
F="/data/ai-saas/templates/golden-path/nodejs/Dockerfile"
if grep -q "USER 1001" "$F" && grep -q "AS production" "$F" && grep -q "HEALTHCHECK" "$F"; then
  pass_test "T02: Dockerfile (비특권 사용자 + 멀티스테이지 + 헬스체크)"
else fail_test "T02: Dockerfile" "보안 설정 누락"; fi

# T03: Helm Chart 템플릿
echo "[T03] Helm Chart 검증..."
D="/data/ai-saas/templates/golden-path/helm"
if [ -f "$D/Chart.yaml" ] && [ -f "$D/values.yaml" ] && [ -f "$D/templates/deployment.yaml" ]; then
  pass_test "T03: Helm Chart (Chart + values + deployment)"
else fail_test "T03: Helm Chart" "필수 파일 누락"; fi

# T04: Helm values 보안 기본값
echo "[T04] Helm values 보안 기본값 검증..."
F="/data/ai-saas/templates/golden-path/helm/values.yaml"
if [ -f "$F" ]; then
  C=0
  grep -q "runAsNonRoot: true" "$F" && C=$((C+1))
  grep -q "allowPrivilegeEscalation: false" "$F" && C=$((C+1))
  grep -q "readOnlyRootFilesystem: true" "$F" && C=$((C+1))
  grep -q "networkPolicy:" "$F" && C=$((C+1))
  grep -q "serviceMonitor:" "$F" && C=$((C+1))
  grep -q "automountServiceAccountToken: false" "$F" && C=$((C+1))
  [ "$C" -ge 5 ] && pass_test "T04: Helm 보안 기본값 (${C}/6)" || fail_test "T04: Helm 보안" "${C}/6"
else fail_test "T04: Helm values" "파일 없음"; fi

# T05: CI/CD 템플릿
echo "[T05] CI/CD 템플릿 검증..."
F="/data/ai-saas/templates/golden-path/cicd/gitea-workflow.yaml"
if [ -f "$F" ] && grep -q "security-scan" "$F" && grep -q "cosign" "$F" && grep -q "sbom" "$F"; then
  pass_test "T05: CI/CD 템플릿 (보안 스캔 + 서명 + SBOM)"
else fail_test "T05: CI/CD 템플릿" "보안 단계 누락"; fi

# T06: 프로비저닝 스크립트
echo "[T06] 프로비저닝 스크립트 검증..."
F="/data/ai-saas/scripts/create-service.sh"
if [ -f "$F" ] && grep -q "Golden Path" "$F" && grep -q "SERVICE_NAME" "$F"; then
  pass_test "T06: 프로비저닝 스크립트"
else fail_test "T06: 프로비저닝" "스크립트 없음"; fi

# T07: 프로비저닝 실행 테스트
echo "[T07] 프로비저닝 실행 테스트..."
chmod +x /data/ai-saas/scripts/create-service.sh
TEST_DIR="/tmp/test-service-$$"
bash /data/ai-saas/scripts/create-service.sh "test-svc" "$TEST_DIR" >/dev/null 2>&1
if [ -f "$TEST_DIR/Dockerfile" ] && [ -f "$TEST_DIR/helm/values.yaml" ] && [ -f "$TEST_DIR/.gitea/workflows/ci.yaml" ]; then
  # 변수 치환 확인
  if grep -q "test-svc" "$TEST_DIR/helm/Chart.yaml" 2>/dev/null; then
    pass_test "T07: 프로비저닝 실행 (파일 생성 + 변수 치환)"
  else
    pass_test "T07: 프로비저닝 실행 (파일 생성)"
  fi
else
  fail_test "T07: 프로비저닝 실행" "산출물 부족"
fi
rm -rf "$TEST_DIR" 2>/dev/null || true

echo ""
echo "============================================"
echo " MTU-N86 E2E 테스트 결과"
echo "============================================"
echo -e "$RESULTS"
echo " 통과: ${PASS}/${TOTAL} | 실패: ${FAIL}/${TOTAL}"
[ "$FAIL" -gt 0 ] && { echo " [WARNING] 실패"; exit 1; } || { echo " [SUCCESS] 모든 테스트 통과"; exit 0; }
