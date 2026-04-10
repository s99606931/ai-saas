#!/usr/bin/env bash
# 12라운드 통합 E2E 테스트 (MTU-N149~N158)
set -euo pipefail
PROJECT_ROOT="/data/ai-saas"
PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "[FAIL] $1"; }

echo "============================================================"
echo "  12라운드 통합 E2E 테스트 (MTU-N149~N158)"
echo "============================================================"

# === MTU-N149: Cluster API ===
echo ""
echo "=== MTU-N149: Cluster API 수명주기 ==="
[ -d "$PROJECT_ROOT/infra/cluster-api" ] && pass "N149: 디렉토리 존재" || fail "N149: 디렉토리"
[ -f "$PROJECT_ROOT/infra/cluster-api/kustomization.yaml" ] && pass "N149: Kustomization" || fail "N149: Kustomization"
[ -f "$PROJECT_ROOT/infra/cluster-api/workload-cluster-template.yaml" ] && pass "N149: 클러스터 템플릿" || fail "N149: 템플릿"
[ -f "$PROJECT_ROOT/infra/cluster-api/machine-health-check.yaml" ] && pass "N149: MachineHealthCheck" || fail "N149: MHC"
[ -f "$PROJECT_ROOT/infra/cluster-api/flux-kustomization.yaml" ] && pass "N149: Flux 연동" || fail "N149: Flux"

# === MTU-N150: DB 마이그레이션 ===
echo ""
echo "=== MTU-N150: DB 마이그레이션 자동화 ==="
[ -f "$PROJECT_ROOT/infra/db-migration/atlas.hcl" ] && pass "N150: Atlas 설정" || fail "N150: Atlas"
[ -f "$PROJECT_ROOT/infra/db-migration/schema.sql" ] && pass "N150: 스키마 정의" || fail "N150: 스키마"
ls "$PROJECT_ROOT/infra/db-migration/migrations/"*.sql > /dev/null 2>&1 && pass "N150: 마이그레이션 파일" || fail "N150: 마이그레이션"
ls "$PROJECT_ROOT/infra/db-migration/rollback/"*.sql > /dev/null 2>&1 && pass "N150: 롤백 파일" || fail "N150: 롤백"
[ -f "$PROJECT_ROOT/infra/db-migration/ci/migration-ci.yaml" ] && pass "N150: CI 파이프라인" || fail "N150: CI"

# === MTU-N151: 백업 검증 ===
echo ""
echo "=== MTU-N151: 백업 자동 검증 ==="
[ -f "$PROJECT_ROOT/infra/backup-verification/velero-verify-cronjob.yaml" ] && pass "N151: Velero 검증" || fail "N151: Velero"
[ -f "$PROJECT_ROOT/infra/backup-verification/cnpg-verify-cronjob.yaml" ] && pass "N151: CNPG 검증" || fail "N151: CNPG"
[ -f "$PROJECT_ROOT/infra/backup-verification/alerts.yaml" ] && pass "N151: 알림 규칙" || fail "N151: 알림"
[ -f "$PROJECT_ROOT/infra/backup-verification/rbac.yaml" ] && pass "N151: RBAC" || fail "N151: RBAC"

# === MTU-N152: Cilium Zero Trust ===
echo ""
echo "=== MTU-N152: Cilium L7 Zero Trust ==="
[ -f "$PROJECT_ROOT/infra/cilium-zero-trust/default-deny.yaml" ] && pass "N152: Default Deny" || fail "N152: Deny"
[ -f "$PROJECT_ROOT/infra/cilium-zero-trust/l7-http-policy.yaml" ] && pass "N152: L7 HTTP" || fail "N152: HTTP"
[ -f "$PROJECT_ROOT/infra/cilium-zero-trust/l7-grpc-policy.yaml" ] && pass "N152: L7 gRPC" || fail "N152: gRPC"
[ -f "$PROJECT_ROOT/infra/cilium-zero-trust/identity-aware-policy.yaml" ] && pass "N152: Identity" || fail "N152: ID"
[ -f "$PROJECT_ROOT/infra/cilium-zero-trust/fqdn-egress.yaml" ] && pass "N152: FQDN 이그레스" || fail "N152: FQDN"
[ -f "$PROJECT_ROOT/infra/cilium-zero-trust/hubble-config.yaml" ] && pass "N152: Hubble" || fail "N152: Hubble"

# === MTU-N153: 개인정보보호 ===
echo ""
echo "=== MTU-N153: 개인정보보호법 준수 ==="
[ -f "$PROJECT_ROOT/src/privacy/pii-scanner.ts" ] && pass "N153: PII 스캐너" || fail "N153: PII"
[ -f "$PROJECT_ROOT/infra/privacy-compliance/retention-checker.yaml" ] && pass "N153: 보존기간 점검" || fail "N153: 보존"
[ -f "$PROJECT_ROOT/infra/privacy-compliance/pia-ci-workflow.yaml" ] && pass "N153: PIA CI" || fail "N153: PIA"
[ -f "$PROJECT_ROOT/infra/privacy-compliance/alerts.yaml" ] && pass "N153: 알림" || fail "N153: 알림"

# === MTU-N154: CSAP 갱신 자동화 ===
echo ""
echo "=== MTU-N154: CSAP 갱신 인증 자동화 ==="
[ -f "$PROJECT_ROOT/infra/csap-renewal/csap-compliance-scanner.yaml" ] && pass "N154: CSAP 스캐너" || fail "N154: 스캐너"
grep -q "csap-compliance-scanner" "$PROJECT_ROOT/infra/csap-renewal/csap-compliance-scanner.yaml" && pass "N154: 스캐너 CronJob" || fail "N154: CronJob"
grep -q "CSAPRenewal" "$PROJECT_ROOT/infra/csap-renewal/csap-compliance-scanner.yaml" && pass "N154: 갱신 알림" || fail "N154: 알림"

# === MTU-N155: 데이터 품질 ===
echo ""
echo "=== MTU-N155: 데이터 품질 검증 ==="
[ -f "$PROJECT_ROOT/infra/data-quality/data-quality-checker.yaml" ] && pass "N155: 품질 검증기" || fail "N155: 검증기"
grep -q "data-quality-checker" "$PROJECT_ROOT/infra/data-quality/data-quality-checker.yaml" && pass "N155: CronJob" || fail "N155: CronJob"
grep -q "DataQualityViolation" "$PROJECT_ROOT/infra/data-quality/data-quality-checker.yaml" && pass "N155: 알림" || fail "N155: 알림"
grep -q "SchemaDrift" "$PROJECT_ROOT/infra/data-quality/data-quality-checker.yaml" && pass "N155: 드리프트 감지" || fail "N155: 드리프트"

# === MTU-N156: 런타임 튜닝 ===
echo ""
echo "=== MTU-N156: 런타임 자동 튜닝 ==="
[ -f "$PROJECT_ROOT/infra/runtime-tuning/nodejs-tuning.yaml" ] && pass "N156: Node.js 튜닝" || fail "N156: Node.js"
grep -q "NODE_OPTIONS" "$PROJECT_ROOT/infra/runtime-tuning/nodejs-tuning.yaml" && pass "N156: NODE_OPTIONS" || fail "N156: OPTIONS"
grep -q "JAVA_OPTS" "$PROJECT_ROOT/infra/runtime-tuning/nodejs-tuning.yaml" && pass "N156: JVM 튜닝" || fail "N156: JVM"
grep -q "runtime-auto-tuner" "$PROJECT_ROOT/infra/runtime-tuning/nodejs-tuning.yaml" && pass "N156: 자동 튜너" || fail "N156: 튜너"
grep -q "NodeJSHighMemory" "$PROJECT_ROOT/infra/runtime-tuning/nodejs-tuning.yaml" && pass "N156: 메모리 알림" || fail "N156: 알림"

# === MTU-N157: 보안 카오스 ===
echo ""
echo "=== MTU-N157: 보안 카오스 엔지니어링 ==="
[ -f "$PROJECT_ROOT/infra/security-chaos/security-chaos-experiments.yaml" ] && pass "N157: 실험 파일" || fail "N157: 실험"
grep -q "ChaosExperiment" "$PROJECT_ROOT/infra/security-chaos/security-chaos-experiments.yaml" && pass "N157: ChaosExperiment" || fail "N157: CE"
grep -q "netpolicy-resilience" "$PROJECT_ROOT/infra/security-chaos/security-chaos-experiments.yaml" && pass "N157: 네트워크 정책 실험" || fail "N157: NetPol"
grep -q "rbac-escalation" "$PROJECT_ROOT/infra/security-chaos/security-chaos-experiments.yaml" && pass "N157: RBAC 실험" || fail "N157: RBAC"
grep -q "pss-violation" "$PROJECT_ROOT/infra/security-chaos/security-chaos-experiments.yaml" && pass "N157: PSS 실험" || fail "N157: PSS"
grep -q "ChaosEngine" "$PROJECT_ROOT/infra/security-chaos/security-chaos-experiments.yaml" && pass "N157: ChaosEngine" || fail "N157: Engine"
grep -q "SecurityChaosExperimentFailed" "$PROJECT_ROOT/infra/security-chaos/security-chaos-experiments.yaml" && pass "N157: 실패 알림" || fail "N157: 알림"

# === CSAP/N2SF 전체 보안 검증 ===
echo ""
echo "=== CSAP/N2SF 전체 보안 검증 ==="

# 모든 인프라 파일에서 runAsNonRoot 확인
SECURITY_FILES=(
  "infra/cluster-api/decommission-cronjob.yaml"
  "infra/backup-verification/velero-verify-cronjob.yaml"
  "infra/privacy-compliance/retention-checker.yaml"
  "infra/csap-renewal/csap-compliance-scanner.yaml"
  "infra/data-quality/data-quality-checker.yaml"
  "infra/runtime-tuning/nodejs-tuning.yaml"
)
for f in "${SECURITY_FILES[@]}"; do
  if grep -q "runAsNonRoot: true" "$PROJECT_ROOT/$f" 2>/dev/null; then
    pass "보안: $f — 비root"
  else
    fail "보안: $f — 비root 미설정"
  fi
done

# Plan+Design 문서 존재 확인
for n in N149 N150 N151 N152 N153 N154 N155 N156 N157; do
  DIR=$(ls -d "$PROJECT_ROOT/docs/archive/2026-04/MTU-${n}-"* 2>/dev/null | head -1)
  if [ -n "$DIR" ]; then
    if ls "$DIR/"*.plan.md > /dev/null 2>&1; then
      pass "문서: $n Plan 존재"
    else
      fail "문서: $n Plan 미존재"
    fi
    if ls "$DIR/"*.design.md > /dev/null 2>&1; then
      pass "문서: $n Design 존재"
    else
      fail "문서: $n Design 미존재"
    fi
  else
    fail "문서: $n 아카이브 디렉토리 미존재"
  fi
done

echo ""
echo "============================================================"
echo "  12라운드 통합 테스트 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "============================================================"
[ "$FAIL" -eq 0 ] && echo "[SUCCESS] 12라운드 통합 테스트 전체 통과" && exit 0 || { echo "[FAILURE] $FAIL 건 실패"; exit 1; }
