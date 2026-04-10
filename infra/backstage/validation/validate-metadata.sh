#!/bin/bash
# Backstage 서비스 카탈로그 메타데이터 검증 스크립트
# Design Ref: MTU-N170.design.md §5
# Plan SC: FR-N170.3
# CI 파이프라인에서 PR 시 자동 실행하여 메타데이터 품질 보장
#
# 사용법: ./validate-metadata.sh [catalog-info.yaml 경로]
# 종료 코드: 0=성공, 1=필수 필드 누락, 2=형식 오류

set -euo pipefail

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 검증 결과 카운터
ERRORS=0
WARNINGS=0
CHECKED=0

log_pass() {
  echo -e "  ${GREEN}[PASS]${NC} $1"
  CHECKED=$((CHECKED + 1))
}

log_fail() {
  echo -e "  ${RED}[FAIL]${NC} $1"
  ERRORS=$((ERRORS + 1))
  CHECKED=$((CHECKED + 1))
}

log_warn() {
  echo -e "  ${YELLOW}[WARN]${NC} $1"
  WARNINGS=$((WARNINGS + 1))
  CHECKED=$((CHECKED + 1))
}

# -----------------------------------------------------------------------
# 대상 파일 결정
# -----------------------------------------------------------------------
if [ $# -ge 1 ]; then
  FILES="$@"
else
  # 변경된 catalog-info.yaml 파일 자동 감지
  FILES=$(find . -name "catalog-info.yaml" -o -name "all-components.yaml" | head -50)
fi

if [ -z "$FILES" ]; then
  echo "검증 대상 파일이 없습니다."
  exit 0
fi

echo "=========================================="
echo " Backstage 메타데이터 검증 (MTU-N170)"
echo "=========================================="
echo ""

for FILE in $FILES; do
  echo "검증 대상: $FILE"
  echo "------------------------------------------"

  # YAML 구문 검증
  if command -v yamllint > /dev/null 2>&1; then
    if yamllint -d "{extends: relaxed, rules: {line-length: {max: 200}}}" "$FILE" > /dev/null 2>&1; then
      log_pass "YAML 구문 유효"
    else
      log_fail "YAML 구문 오류"
      continue
    fi
  else
    # yamllint 없으면 yq로 기본 검증
    if yq eval '.' "$FILE" > /dev/null 2>&1; then
      log_pass "YAML 파싱 성공"
    else
      log_fail "YAML 파싱 실패"
      continue
    fi
  fi

  # 멀티 문서 처리 (--- 구분자)
  DOC_COUNT=$(yq eval-all '. | select(.kind == "Component") | .metadata.name' "$FILE" 2>/dev/null | wc -l)
  echo "  컴포넌트 수: $DOC_COUNT"

  # 각 Component에 대해 필수 필드 검증
  for idx in $(seq 0 $((DOC_COUNT - 1))); do
    COMP_NAME=$(yq eval-all "select(.kind == \"Component\") | select(document_index == $idx) | .metadata.name" "$FILE" 2>/dev/null)

    if [ -z "$COMP_NAME" ] || [ "$COMP_NAME" = "null" ]; then
      continue
    fi

    echo ""
    echo "  컴포넌트: $COMP_NAME"

    # --- 필수 필드 검증 ---

    # metadata.name (kebab-case)
    if echo "$COMP_NAME" | grep -qE '^[a-z][a-z0-9-]*$'; then
      log_pass "metadata.name 형식 유효: $COMP_NAME"
    else
      log_fail "metadata.name 형식 오류 (kebab-case 필요): $COMP_NAME"
    fi

    # metadata.description
    DESC=$(yq eval-all "select(.kind == \"Component\") | select(document_index == $idx) | .metadata.description" "$FILE" 2>/dev/null)
    if [ -n "$DESC" ] && [ "$DESC" != "null" ] && [ ${#DESC} -ge 10 ]; then
      log_pass "metadata.description 유효 (${#DESC}자)"
    else
      log_fail "metadata.description 누락 또는 10자 미만"
    fi

    # metadata.tags
    TAGS=$(yq eval-all "select(.kind == \"Component\") | select(document_index == $idx) | .metadata.tags | length" "$FILE" 2>/dev/null)
    if [ "$TAGS" != "null" ] && [ "$TAGS" -ge 1 ] 2>/dev/null; then
      log_pass "metadata.tags 유효 (${TAGS}개)"
    else
      log_fail "metadata.tags 누락 또는 빈 배열"
    fi

    # backstage.io/kubernetes-id
    K8S_ID=$(yq eval-all "select(.kind == \"Component\") | select(document_index == $idx) | .metadata.annotations.\"backstage.io/kubernetes-id\"" "$FILE" 2>/dev/null)
    if [ -n "$K8S_ID" ] && [ "$K8S_ID" != "null" ]; then
      log_pass "kubernetes-id 유효: $K8S_ID"
    else
      log_warn "backstage.io/kubernetes-id 누락 (권장)"
    fi

    # spec.type
    TYPE=$(yq eval-all "select(.kind == \"Component\") | select(document_index == $idx) | .spec.type" "$FILE" 2>/dev/null)
    if echo "$TYPE" | grep -qE '^(service|library|website|documentation)$'; then
      log_pass "spec.type 유효: $TYPE"
    else
      log_fail "spec.type 누락 또는 유효하지 않음: $TYPE"
    fi

    # spec.lifecycle
    LIFECYCLE=$(yq eval-all "select(.kind == \"Component\") | select(document_index == $idx) | .spec.lifecycle" "$FILE" 2>/dev/null)
    if echo "$LIFECYCLE" | grep -qE '^(development|staging|production|deprecated)$'; then
      log_pass "spec.lifecycle 유효: $LIFECYCLE"
    else
      log_fail "spec.lifecycle 누락 또는 유효하지 않음: $LIFECYCLE"
    fi

    # spec.owner
    OWNER=$(yq eval-all "select(.kind == \"Component\") | select(document_index == $idx) | .spec.owner" "$FILE" 2>/dev/null)
    if [ -n "$OWNER" ] && [ "$OWNER" != "null" ]; then
      log_pass "spec.owner 유효: $OWNER"
    else
      log_fail "spec.owner 누락"
    fi

    # spec.system
    SYSTEM=$(yq eval-all "select(.kind == \"Component\") | select(document_index == $idx) | .spec.system" "$FILE" 2>/dev/null)
    if [ -n "$SYSTEM" ] && [ "$SYSTEM" != "null" ]; then
      log_pass "spec.system 유효: $SYSTEM"
    else
      log_fail "spec.system 누락"
    fi

    # --- 커스텀 어노테이션 (N2SF/CSAP) ---

    # saas.local/data-classification
    DATA_CLASS=$(yq eval-all "select(.kind == \"Component\") | select(document_index == $idx) | .metadata.annotations.\"saas.local/data-classification\"" "$FILE" 2>/dev/null)
    if echo "$DATA_CLASS" | grep -qE '^(O|C|S)$'; then
      log_pass "data-classification 유효: $DATA_CLASS"
    else
      log_warn "saas.local/data-classification 누락 (N2SF 준수 권장)"
    fi

    # saas.local/tier
    TIER=$(yq eval-all "select(.kind == \"Component\") | select(document_index == $idx) | .metadata.annotations.\"saas.local/tier\"" "$FILE" 2>/dev/null)
    if echo "$TIER" | grep -qE '^(critical|standard|background)$'; then
      log_pass "tier 유효: $TIER"
    else
      log_warn "saas.local/tier 누락 (SLO 관리 권장)"
    fi

    # saas.local/slo-target
    SLO=$(yq eval-all "select(.kind == \"Component\") | select(document_index == $idx) | .metadata.annotations.\"saas.local/slo-target\"" "$FILE" 2>/dev/null)
    if echo "$SLO" | grep -qE '^[0-9]+\.[0-9]+%$'; then
      log_pass "slo-target 유효: $SLO"
    else
      log_warn "saas.local/slo-target 누락 (SLA 관리 권장)"
    fi
  done

  echo ""
done

# -----------------------------------------------------------------------
# 결과 요약
# -----------------------------------------------------------------------
echo "=========================================="
echo " 검증 결과 요약"
echo "=========================================="
echo "  검증 항목: $CHECKED"
echo -e "  ${GREEN}통과: $((CHECKED - ERRORS - WARNINGS))${NC}"
echo -e "  ${RED}실패: $ERRORS${NC}"
echo -e "  ${YELLOW}경고: $WARNINGS${NC}"
echo ""

if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}메타데이터 검증 실패 — $ERRORS개 필수 항목 미충족${NC}"
  echo "catalog-info.yaml 표준 템플릿을 참조하십시오:"
  echo "  infra/backstage/templates/catalog-info-standard.yaml"
  exit 1
fi

if [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}경고 사항이 있습니다 — $WARNINGS개 권장 항목 미충족${NC}"
  exit 0
fi

echo -e "${GREEN}모든 메타데이터 검증 통과${NC}"
exit 0
