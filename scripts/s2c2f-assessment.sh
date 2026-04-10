#!/usr/bin/env bash
# Design Ref: MTU-N80 §성숙도 평가 기준
# Plan SC: FR-N80.7
# S2C2F 성숙도 자동 평가 스크립트
set -euo pipefail

echo "============================================"
echo " S2C2F 공급망 소비 프레임워크 성숙도 평가"
echo " OpenSSF / Microsoft S2C2F v1.1"
echo " 공공기관 SaaS 프레임워크"
echo "============================================"
echo ""

SCORE=0
MAX_SCORE=0
RESULTS=""

check_item() {
  local practice="$1"
  local level="$2"
  local description="$3"
  local check_cmd="$4"
  local points="$5"

  MAX_SCORE=$((MAX_SCORE + points))

  if eval "$check_cmd" >/dev/null 2>&1; then
    SCORE=$((SCORE + points))
    RESULTS="${RESULTS}\n  [PASS] ${practice} (${level}): ${description} [+${points}점]"
  else
    RESULTS="${RESULTS}\n  [FAIL] ${practice} (${level}): ${description} [0/${points}점]"
  fi
}

# -----------------------------------------------
# P1: Ingest (의존성 인입) — Level 1
# -----------------------------------------------
echo "[P1] 의존성 인입 (Ingest) 평가..."

check_item "P1.1" "L1" "Renovate Bot CronJob 존재" \
  "test -f /data/ai-saas/infra/renovate/cronjob.yaml" 10

check_item "P1.2" "L1" "Renovate 설정 파일 존재" \
  "test -f /data/ai-saas/infra/renovate/configmap.yaml" 10

check_item "P1.3" "L1" "package.json/requirements.txt 의존성 선언" \
  "find /data/ai-saas -name 'package.json' -maxdepth 3 | head -1 | grep -q ." 5

# -----------------------------------------------
# P2: Scan (취약점 스캔) — Level 1
# -----------------------------------------------
echo "[P2] 취약점 스캔 (Scan) 평가..."

check_item "P2.1" "L1" "Trivy Operator 설치 매니페스트" \
  "test -d /data/ai-saas/infra/trivy-operator" 10

check_item "P2.2" "L1" "Grype/취약점 스캔 CI 연동" \
  "find /data/ai-saas -name '*.yaml' -path '*/cicd/*' | xargs grep -l 'grype\\|trivy\\|vulnerability' 2>/dev/null | head -1 | grep -q ." 10

check_item "P2.3" "L1" "Kyverno 취약점 차단 정책" \
  "test -f /data/ai-saas/infra/security/s2c2f/kyverno-policies.yaml" 10

# -----------------------------------------------
# P3: Inventory (의존성 목록) — Level 2
# -----------------------------------------------
echo "[P3] 의존성 목록 (Inventory) 평가..."

check_item "P3.1" "L2" "SBOM 생성 설정 존재" \
  "find /data/ai-saas -name '*.yaml' | xargs grep -l 'sbom\\|syft\\|cyclonedx' 2>/dev/null | head -1 | grep -q ." 10

check_item "P3.2" "L2" "라이선스 검사 정책" \
  "test -f /data/ai-saas/infra/security/s2c2f/license-check.yaml" 10

# -----------------------------------------------
# P4: Update (자동 갱신) — Level 2
# -----------------------------------------------
echo "[P4] 자동 갱신 (Update) 평가..."

check_item "P4.1" "L2" "자동머지 정책 정의" \
  "test -f /data/ai-saas/infra/renovate/automerge-policy.yaml" 10

check_item "P4.2" "L2" "보안 패치 SLA 정의" \
  "grep -q 'sla' /data/ai-saas/infra/security/s2c2f/policy.yaml 2>/dev/null" 10

# -----------------------------------------------
# P5: Enforce (정책 강제) — Level 3
# -----------------------------------------------
echo "[P5] 정책 강제 (Enforce) 평가..."

check_item "P5.1" "L3" "허용 레지스트리 정책" \
  "grep -q 'allowed-registries' /data/ai-saas/infra/security/s2c2f/kyverno-policies.yaml 2>/dev/null" 10

check_item "P5.2" "L3" "이미지 서명 검증 정책" \
  "test -f /data/ai-saas/infra/kyverno/verify-image-signature.yaml" 10

check_item "P5.3" "L3" "SBOM 첨부 검증 정책" \
  "grep -q 'sbom-attestation' /data/ai-saas/infra/security/s2c2f/kyverno-policies.yaml 2>/dev/null" 10

# -----------------------------------------------
# P6: Rebuild (재빌드) — Level 3
# -----------------------------------------------
echo "[P6] 재빌드 (Rebuild) 평가..."

check_item "P6.1" "L3" "Gitea Actions CI 파이프라인" \
  "find /data/ai-saas -name '*.yaml' -path '*cicd*' | head -1 | grep -q ." 10

check_item "P6.2" "L3" "SLSA Provenance 생성" \
  "test -f /data/ai-saas/infra/kyverno/verify-provenance.yaml" 10

# -----------------------------------------------
# P7: Fix+Upstream (수정) — Level 3
# -----------------------------------------------
echo "[P7] 수정 및 Upstream (Fix+Upstream) 평가..."

check_item "P7.1" "L3" "Renovate 보안 패치 자동 PR" \
  "grep -q 'security' /data/ai-saas/infra/renovate/configmap.yaml 2>/dev/null" 10

# -----------------------------------------------
# P8: Audit (감사) — Level 2
# -----------------------------------------------
echo "[P8] 감사 (Audit) 평가..."

check_item "P8.1" "L2" "감사 로그 파일 존재" \
  "test -f /data/ai-saas/.claude/audit.jsonl" 10

check_item "P8.2" "L2" "S2C2F 정책 문서 존재" \
  "test -f /data/ai-saas/infra/security/s2c2f/policy.yaml" 10

# -----------------------------------------------
# 성숙도 계산
# -----------------------------------------------
echo ""
echo "============================================"
echo " S2C2F 성숙도 평가 결과"
echo "============================================"
echo -e "$RESULTS"
echo ""

PERCENTAGE=$((SCORE * 100 / MAX_SCORE))

echo "--------------------------------------------"
echo " 점수: ${SCORE}/${MAX_SCORE} (${PERCENTAGE}%)"
echo "--------------------------------------------"

if [ "$PERCENTAGE" -ge 90 ]; then
  echo " 성숙도: Level 3 (Verified Ingestion) 달성"
elif [ "$PERCENTAGE" -ge 70 ]; then
  echo " 성숙도: Level 2 (Managed) 달성"
elif [ "$PERCENTAGE" -ge 40 ]; then
  echo " 성숙도: Level 1 (Aware) 달성"
else
  echo " 성숙도: Level 0 (미달)"
fi

echo ""
exit 0
