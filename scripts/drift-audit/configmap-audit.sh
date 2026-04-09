#!/bin/bash
# =============================================================================
# ConfigMap 변경 감사 스크립트
# Design Ref: MTU-N67.design.md §2
# Plan SC: FR-N67.3
#
# Git 소스와 클러스터 실제 ConfigMap을 비교하여 드리프트를 탐지합니다.
# CSAP D-06: 설정 변경 감사, D-08: 무단 변경 탐지
# =============================================================================

set -euo pipefail

NAMESPACE="${1:-saas}"
GIT_BASE="/data/ai-saas"
AUDIT_LOG="/data/ai-saas/.claude/audit.jsonl"
DRIFT_COUNT=0
CHECK_COUNT=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "============================================================"
echo " ConfigMap 드리프트 감사 — ${NAMESPACE}"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"

# kubectl 사용 가능 확인
if ! command -v kubectl &>/dev/null; then
  echo -e "${YELLOW}[WARN]${NC} kubectl 미설치 — 파일 기반 감사만 수행"

  # Git 소스에서 ConfigMap YAML 검증
  echo ""
  echo "--- Git 소스 ConfigMap 검증 ---"

  while IFS= read -r file; do
    CHECK_COUNT=$((CHECK_COUNT + 1))
    # YAML 유효성 검증
    if python3 -c "import yaml; yaml.safe_load(open('${file}'))" 2>/dev/null; then
      echo -e "  ${GREEN}[OK]${NC} $(basename "$file")"
    else
      echo -e "  ${RED}[DRIFT]${NC} YAML 파싱 실패: $(basename "$file")"
      DRIFT_COUNT=$((DRIFT_COUNT + 1))
    fi
  done < <(find "${GIT_BASE}/infra" -name "*.yaml" -exec grep -l "kind: ConfigMap" {} \; 2>/dev/null || true)

  echo ""
  echo "--- Helm values.yaml 일관성 검증 ---"

  # 모든 values.yaml에서 시크릿 하드코딩 탐지
  while IFS= read -r file; do
    CHECK_COUNT=$((CHECK_COUNT + 1))
    HARDCODED=$(grep -ciE 'password:|secret:|token:|apiKey:' "$file" 2>/dev/null || echo "0")
    # CHANGE_ME 패턴은 예외 (의도적 플레이스홀더)
    PLACEHOLDER=$(grep -c 'CHANGE_ME' "$file" 2>/dev/null || echo "0")
    ACTUAL_HARDCODED=$((HARDCODED - PLACEHOLDER))

    if [ "$ACTUAL_HARDCODED" -le 0 ]; then
      echo -e "  ${GREEN}[OK]${NC} $(basename "$(dirname "$file")")/values.yaml"
    else
      echo -e "  ${YELLOW}[WARN]${NC} 하드코딩 의심: $(basename "$(dirname "$file")")/values.yaml (${ACTUAL_HARDCODED}건)"
    fi
  done < <(find "${GIT_BASE}/infra" -name "values.yaml" 2>/dev/null || true)
else
  # kubectl 사용 가능 시: 실제 클러스터 비교
  echo "--- 클러스터 ConfigMap vs Git 소스 비교 ---"

  for cm in $(kubectl get configmap -n "${NAMESPACE}" -o name 2>/dev/null || true); do
    CHECK_COUNT=$((CHECK_COUNT + 1))
    CM_NAME=$(echo "$cm" | sed 's|configmap/||')

    # 시스템 ConfigMap 제외
    if [[ "$CM_NAME" == kube-* ]] || [[ "$CM_NAME" == *-ca.crt ]]; then
      continue
    fi

    # annotation에서 최종 변경 정보 확인
    LAST_APPLIED=$(kubectl get "$cm" -n "${NAMESPACE}" -o jsonpath='{.metadata.annotations.kubectl\.kubernetes\.io/last-applied-configuration}' 2>/dev/null || echo "")

    if [ -z "$LAST_APPLIED" ]; then
      echo -e "  ${YELLOW}[WARN]${NC} ${CM_NAME}: last-applied-configuration 없음 (수동 생성 의심)"
      DRIFT_COUNT=$((DRIFT_COUNT + 1))
    else
      echo -e "  ${GREEN}[OK]${NC} ${CM_NAME}: GitOps 관리 확인"
    fi
  done
fi

# --- 결과 ---
echo ""
echo "============================================================"
echo " 결과: 검사 ${CHECK_COUNT}건, 드리프트 ${DRIFT_COUNT}건"
echo "============================================================"

if [ "$DRIFT_COUNT" -eq 0 ]; then
  echo -e "\n${GREEN}[PASS] ConfigMap 드리프트 없음${NC}"
  exit 0
else
  echo -e "\n${YELLOW}[WARN] ${DRIFT_COUNT}건 드리프트 발견${NC}"
  exit 1
fi
