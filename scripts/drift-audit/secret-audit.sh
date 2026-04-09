#!/bin/bash
# =============================================================================
# Secret 변경 감사 스크립트
# Design Ref: MTU-N67.design.md §2
# Plan SC: FR-N67.4
#
# Git 소스에서 시크릿 관리 정책 준수 여부를 검증합니다.
# CSAP D-09: 시크릿 관리, D-06: 변경 감사
# =============================================================================

set -euo pipefail

GIT_BASE="/data/ai-saas"
AUDIT_LOG="/data/ai-saas/.claude/audit.jsonl"
VIOLATION_COUNT=0
CHECK_COUNT=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "============================================================"
echo " Secret 관리 감사"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"

# --- 1. 평문 시크릿 탐지 ---
echo ""
echo "--- 평문 시크릿 파일 탐지 ---"

while IFS= read -r file; do
  CHECK_COUNT=$((CHECK_COUNT + 1))
  # SealedSecret은 예외
  if grep -q "kind: SealedSecret" "$file" 2>/dev/null; then
    echo -e "  ${GREEN}[OK]${NC} $(basename "$file"): SealedSecret (암호화됨)"
    continue
  fi

  # ExternalSecret은 예외 (참조만 포함)
  if grep -q "kind: ExternalSecret" "$file" 2>/dev/null; then
    echo -e "  ${GREEN}[OK]${NC} $(basename "$file"): ExternalSecret (참조)"
    continue
  fi

  # CHANGE_ME 플레이스홀더는 허용
  if grep -q "CHANGE_ME" "$file" 2>/dev/null; then
    echo -e "  ${YELLOW}[WARN]${NC} $(basename "$file"): 플레이스홀더 (배포 전 교체 필수)"
    continue
  fi

  # 평문 Secret 탐지
  if grep -q "kind: Secret" "$file" 2>/dev/null; then
    HAS_DATA=$(grep -c "^  [a-zA-Z].*:" "$file" 2>/dev/null || echo "0")
    if [ "$HAS_DATA" -gt 0 ]; then
      echo -e "  ${RED}[VIOLATION]${NC} $(basename "$file"): 평문 Secret (SealedSecret으로 교체 필요)"
      VIOLATION_COUNT=$((VIOLATION_COUNT + 1))
    fi
  fi
done < <(find "${GIT_BASE}/infra" -name "*.yaml" -exec grep -l "kind: Secret\|kind: SealedSecret\|kind: ExternalSecret" {} \; 2>/dev/null || true)

# --- 2. .env 파일 탐지 ---
echo ""
echo "--- .env 파일 탐지 ---"

while IFS= read -r file; do
  CHECK_COUNT=$((CHECK_COUNT + 1))
  # .env.example은 허용
  if [[ "$file" == *.example ]] || [[ "$file" == *.template ]]; then
    echo -e "  ${GREEN}[OK]${NC} $(basename "$file"): 템플릿 파일"
    continue
  fi
  echo -e "  ${RED}[VIOLATION]${NC} $(basename "$file"): .env 파일 발견 (Git 추적 금지)"
  VIOLATION_COUNT=$((VIOLATION_COUNT + 1))
done < <(find "${GIT_BASE}" -name ".env" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null || true)

# --- 3. 하드코딩된 시크릿 패턴 탐지 ---
echo ""
echo "--- 하드코딩 시크릿 패턴 탐지 ---"

PATTERNS=(
  "sk-[a-zA-Z0-9]{20,}"
  "ghp_[a-zA-Z0-9]{36}"
  "ghu_[a-zA-Z0-9]{36}"
  "-----BEGIN.*PRIVATE KEY-----"
  "password.*=.*['\"][^CHANGE][^'\"]{8,}"
)

for pattern in "${PATTERNS[@]}"; do
  CHECK_COUNT=$((CHECK_COUNT + 1))
  FOUND=$(grep -rlE "$pattern" "${GIT_BASE}/infra" "${GIT_BASE}/src" 2>/dev/null | grep -v node_modules | grep -v ".git" | head -5 || true)
  if [ -n "$FOUND" ]; then
    echo -e "  ${RED}[VIOLATION]${NC} 패턴 '${pattern:0:20}...' 발견:"
    echo "$FOUND" | while read -r f; do
      echo "    - $f"
    done
    VIOLATION_COUNT=$((VIOLATION_COUNT + 1))
  else
    echo -e "  ${GREEN}[OK]${NC} 패턴 '${pattern:0:25}...' 미발견"
  fi
done

# --- 4. ESO + Sealed Secrets 이중 관리 검증 ---
echo ""
echo "--- ESO + Sealed Secrets 이중 관리 검증 ---"

CHECK_COUNT=$((CHECK_COUNT + 1))
SEALED_COUNT=$(find "${GIT_BASE}/infra" -name "*.yaml" -exec grep -l "kind: SealedSecret" {} \; 2>/dev/null | wc -l || echo "0")
ESO_COUNT=$(find "${GIT_BASE}/infra" -name "*.yaml" -exec grep -l "kind: ExternalSecret" {} \; 2>/dev/null | wc -l || echo "0")

echo -e "  Sealed Secrets: ${SEALED_COUNT}개"
echo -e "  External Secrets: ${ESO_COUNT}개"

if [ "$SEALED_COUNT" -ge 1 ] || [ "$ESO_COUNT" -ge 1 ]; then
  echo -e "  ${GREEN}[OK]${NC} 시크릿 관리 도구 활성"
else
  echo -e "  ${YELLOW}[WARN]${NC} 시크릿 관리 도구 미구성"
fi

# --- 결과 ---
echo ""
echo "============================================================"
echo " 결과: 검사 ${CHECK_COUNT}건, 위반 ${VIOLATION_COUNT}건"
echo "============================================================"

if [ "$VIOLATION_COUNT" -eq 0 ]; then
  echo -e "\n${GREEN}[PASS] Secret 관리 감사 통과${NC}"
  exit 0
else
  echo -e "\n${RED}[FAIL] ${VIOLATION_COUNT}건 위반 발견${NC}"
  exit 1
fi
