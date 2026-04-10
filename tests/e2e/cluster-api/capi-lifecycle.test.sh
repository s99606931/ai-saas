#!/usr/bin/env bash
# Cluster API 수명주기 자동화 E2E 테스트
# Design Ref: §2 전체 | Plan SC: FR-N149.1~FR-N149.7
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CAPI_DIR="$PROJECT_ROOT/infra/cluster-api"
PASS=0
FAIL=0
TOTAL=0

pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "[FAIL] $1"; }

echo "=========================================="
echo "  MTU-N149 Cluster API E2E 테스트"
echo "=========================================="

# TC-N149.1: CAPI 매니페스트 구조 검증
echo ""
echo "--- TC-N149.1: CAPI 매니페스트 구조 검증 ---"

if [ -f "$CAPI_DIR/kustomization.yaml" ]; then
  pass "TC-N149.1a: kustomization.yaml 존재"
else
  fail "TC-N149.1a: kustomization.yaml 미존재"
fi

REQUIRED_FILES=(
  "namespace.yaml"
  "rbac.yaml"
  "workload-cluster-template.yaml"
  "machine-deployment.yaml"
  "machine-health-check.yaml"
  "decommission-cronjob.yaml"
  "audit-config.yaml"
  "flux-kustomization.yaml"
)
for f in "${REQUIRED_FILES[@]}"; do
  if [ -f "$CAPI_DIR/$f" ]; then
    pass "TC-N149.1b: $f 존재"
  else
    fail "TC-N149.1b: $f 미존재"
  fi
done

# TC-N149.2: 워크로드 클러스터 템플릿 검증
echo ""
echo "--- TC-N149.2: 워크로드 클러스터 템플릿 검증 ---"

if grep -q "kind: Cluster" "$CAPI_DIR/workload-cluster-template.yaml"; then
  pass "TC-N149.2a: Cluster CR 정의 존재"
else
  fail "TC-N149.2a: Cluster CR 정의 미존재"
fi

if grep -q "kind: KubeadmControlPlane" "$CAPI_DIR/workload-cluster-template.yaml"; then
  pass "TC-N149.2b: KubeadmControlPlane 정의 존재"
else
  fail "TC-N149.2b: KubeadmControlPlane 정의 미존재"
fi

if grep -q "kind: DockerCluster" "$CAPI_DIR/workload-cluster-template.yaml"; then
  pass "TC-N149.2c: DockerCluster 프로바이더 정의 존재"
else
  fail "TC-N149.2c: DockerCluster 프로바이더 정의 미존재"
fi

if grep -q "v1beta1" "$CAPI_DIR/workload-cluster-template.yaml"; then
  pass "TC-N149.2d: CAPI v1beta1 API 버전 사용"
else
  fail "TC-N149.2d: CAPI v1beta1 API 버전 미사용"
fi

# TC-N149.3: 스케일링 정책 검증
echo ""
echo "--- TC-N149.3: 스케일링 정책 검증 ---"

if grep -q "kind: MachineDeployment" "$CAPI_DIR/machine-deployment.yaml"; then
  pass "TC-N149.3a: MachineDeployment 정의 존재"
else
  fail "TC-N149.3a: MachineDeployment 정의 미존재"
fi

if grep -q "autoscaler-node-group-min-size" "$CAPI_DIR/machine-deployment.yaml"; then
  pass "TC-N149.3b: Cluster Autoscaler 어노테이션 존재"
else
  fail "TC-N149.3b: Cluster Autoscaler 어노테이션 미존재"
fi

if grep -q "maxSurge: 1" "$CAPI_DIR/machine-deployment.yaml" && \
   grep -q "maxUnavailable: 0" "$CAPI_DIR/machine-deployment.yaml"; then
  pass "TC-N149.3c: 무중단 롤링 업데이트 전략 설정"
else
  fail "TC-N149.3c: 무중단 롤링 업데이트 전략 미설정"
fi

# TC-N149.4: 머신 헬스체크 검증
echo ""
echo "--- TC-N149.4: 머신 헬스체크 검증 ---"

if grep -q "kind: MachineHealthCheck" "$CAPI_DIR/machine-health-check.yaml"; then
  pass "TC-N149.4a: MachineHealthCheck 정의 존재"
else
  fail "TC-N149.4a: MachineHealthCheck 정의 미존재"
fi

MHC_COUNT=$(grep -c "kind: MachineHealthCheck" "$CAPI_DIR/machine-health-check.yaml")
if [ "$MHC_COUNT" -ge 2 ]; then
  pass "TC-N149.4b: CP + Worker MHC 각각 정의 ($MHC_COUNT개)"
else
  fail "TC-N149.4b: CP + Worker MHC 부족 ($MHC_COUNT개)"
fi

# TC-N149.5: 해체 자동화 검증
echo ""
echo "--- TC-N149.5: 클러스터 해체 자동화 검증 ---"

if grep -q "kind: CronJob" "$CAPI_DIR/decommission-cronjob.yaml"; then
  pass "TC-N149.5a: 해체 점검 CronJob 정의 존재"
else
  fail "TC-N149.5a: 해체 점검 CronJob 정의 미존재"
fi

if grep -q "lifecycle/expires" "$CAPI_DIR/decommission-cronjob.yaml"; then
  pass "TC-N149.5b: 만료 어노테이션 기반 감지 로직 존재"
else
  fail "TC-N149.5b: 만료 어노테이션 기반 감지 로직 미존재"
fi

# TC-N149.6: Flux GitOps 연동 검증
echo ""
echo "--- TC-N149.6: Flux GitOps 연동 검증 ---"

if grep -q "kind: Kustomization" "$CAPI_DIR/flux-kustomization.yaml"; then
  pass "TC-N149.6a: Flux Kustomization 정의 존재"
else
  fail "TC-N149.6a: Flux Kustomization 정의 미존재"
fi

if grep -q "healthChecks" "$CAPI_DIR/flux-kustomization.yaml"; then
  pass "TC-N149.6b: 헬스체크 설정 존재"
else
  fail "TC-N149.6b: 헬스체크 설정 미존재"
fi

# TC-N149.7: 감사 로그 설정 검증
echo ""
echo "--- TC-N149.7: 감사 로그 및 보안 검증 ---"

if grep -q "level: RequestResponse" "$CAPI_DIR/audit-config.yaml"; then
  pass "TC-N149.7a: 감사 로그 RequestResponse 레벨 설정"
else
  fail "TC-N149.7a: 감사 로그 RequestResponse 레벨 미설정"
fi

if grep -q "audit-log-maxage.*365" "$CAPI_DIR/workload-cluster-template.yaml"; then
  pass "TC-N149.7b: 감사 로그 365일 보존 설정 (CSAP D-06)"
else
  fail "TC-N149.7b: 감사 로그 365일 보존 미설정"
fi

# CSAP 보안 준수 검증
echo ""
echo "--- CSAP/N2SF 보안 준수 검증 ---"

if grep -q "csap.compliance/domain" "$CAPI_DIR/rbac.yaml"; then
  pass "TC-CSAP.1: CSAP 도메인 레이블 존재 (RBAC)"
else
  fail "TC-CSAP.1: CSAP 도메인 레이블 미존재"
fi

if grep -q "pod-security.kubernetes.io/enforce: restricted" "$CAPI_DIR/namespace.yaml"; then
  pass "TC-CSAP.2: PSS restricted 적용 (CSAP D-11)"
else
  fail "TC-CSAP.2: PSS restricted 미적용"
fi

if grep -q "protect-kernel-defaults" "$CAPI_DIR/workload-cluster-template.yaml"; then
  pass "TC-CSAP.3: kubelet 보안 하드닝 설정 (CSAP D-11)"
else
  fail "TC-CSAP.3: kubelet 보안 하드닝 미설정"
fi

if grep -q "runAsNonRoot: true" "$CAPI_DIR/decommission-cronjob.yaml"; then
  pass "TC-CSAP.4: 비root 실행 설정 (CSAP D-11)"
else
  fail "TC-CSAP.4: 비root 실행 미설정"
fi

if grep -q "n2sf.security/level" "$CAPI_DIR/workload-cluster-template.yaml"; then
  pass "TC-N2SF.1: N2SF 보안 등급 레이블 존재"
else
  fail "TC-N2SF.1: N2SF 보안 등급 레이블 미존재"
fi

# 최종 결과
echo ""
echo "=========================================="
echo "  테스트 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "=========================================="

if [ "$FAIL" -eq 0 ]; then
  echo "[SUCCESS] 모든 테스트 통과"
  exit 0
else
  echo "[FAILURE] $FAIL 건 실패"
  exit 1
fi
