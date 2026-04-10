#!/bin/bash
# Design Ref: MTU-N238 SS1
# Plan SC: FR-CIA.1 ~ FR-CIA.5
# 변경 영향 분석 스크립트 v2

set -euo pipefail

BASE_BRANCH="${1:-main}"
HEAD_REF="${2:-HEAD}"
OUTPUT_FORMAT="${3:-text}"  # text | json | markdown

echo "============================================"
echo " 변경 영향 분석 (Change Impact Analysis)"
echo " 비교: $BASE_BRANCH...$HEAD_REF"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"

# --- 변경 파일 수집 ---
CHANGED_FILES=$(git diff --name-only "$BASE_BRANCH"..."$HEAD_REF" 2>/dev/null || \
                git diff --name-only HEAD~1 2>/dev/null || echo "")

if [ -z "$CHANGED_FILES" ]; then
  echo "변경된 파일이 없습니다."
  exit 0
fi

TOTAL_FILES=$(echo "$CHANGED_FILES" | wc -l)
echo ""
echo "변경 파일 수: $TOTAL_FILES"

# --- 카테고리별 분류 ---
SECURITY_FILES=0; INFRA_FILES=0; DB_FILES=0; API_FILES=0
BUSINESS_FILES=0; CONFIG_FILES=0; TEST_FILES=0; DOC_FILES=0
SCORE=0

classify_file() {
  local file="$1"
  case "$file" in
    */security/*|*/auth/*|*/rbac/*|*/crypto/*|*secret*|*credential*|*/policy/*)
      SECURITY_FILES=$((SECURITY_FILES + 1)); SCORE=$((SCORE + 5));;
    infra/*|*/helm/*|*Dockerfile*|.gitea/workflows/*)
      INFRA_FILES=$((INFRA_FILES + 1)); SCORE=$((SCORE + 4));;
    */migration/*|*/schema/*|*/seeds/*)
      DB_FILES=$((DB_FILES + 1)); SCORE=$((SCORE + 4));;
    */api/*|*/routes/*|*/controllers/*|*/handlers/*)
      API_FILES=$((API_FILES + 1)); SCORE=$((SCORE + 3));;
    src/services/*|packages/*|src/lib/*)
      BUSINESS_FILES=$((BUSINESS_FILES + 1)); SCORE=$((SCORE + 2));;
    tests/*|*.test.*|*.spec.*)
      TEST_FILES=$((TEST_FILES + 1)); SCORE=$((SCORE + 1));;
    docs/*|*.md)
      DOC_FILES=$((DOC_FILES + 1));;  # 가중치 0
    *.yaml|*.json|*.toml)
      CONFIG_FILES=$((CONFIG_FILES + 1)); SCORE=$((SCORE + 2));;
    *)
      BUSINESS_FILES=$((BUSINESS_FILES + 1)); SCORE=$((SCORE + 1));;
  esac
}

while IFS= read -r file; do
  classify_file "$file"
done <<< "$CHANGED_FILES"

# --- 위험도 판정 ---
if [ "$SCORE" -le 5 ]; then
  RISK_LEVEL="LOW"
  RISK_ACTION="자동 배포 가능"
  RISK_COLOR="green"
elif [ "$SCORE" -le 15 ]; then
  RISK_LEVEL="MEDIUM"
  RISK_ACTION="코드 리뷰 필수"
  RISK_COLOR="yellow"
elif [ "$SCORE" -le 30 ]; then
  RISK_LEVEL="HIGH"
  RISK_ACTION="시니어 리뷰 + 스테이징 검증 필수"
  RISK_COLOR="orange"
else
  RISK_LEVEL="CRITICAL"
  RISK_ACTION="보안팀 승인 + 전체 회귀 테스트 필수"
  RISK_COLOR="red"
fi

# --- 보안 파일 감지 (FR-CIA.4) ---
SECURITY_ALERT=""
CRITICAL_DETECTED=false
while IFS= read -r file; do
  case "$file" in
    .env|secrets.*|*credential*)
      SECURITY_ALERT="${SECURITY_ALERT}  [CRITICAL] $file\n"
      CRITICAL_DETECTED=true
      ;;
    */security/*|*/auth/*)
      SECURITY_ALERT="${SECURITY_ALERT}  [HIGH] $file\n"
      ;;
  esac
done <<< "$CHANGED_FILES"

# --- 보고서 출력 ---
echo ""
echo "============================================"
echo " 변경 영향 분석 보고서"
echo "============================================"
echo ""
echo "카테고리별 변경 파일 수:"
echo "  보안:       $SECURITY_FILES (가중치 5)"
echo "  인프라:     $INFRA_FILES (가중치 4)"
echo "  DB:         $DB_FILES (가중치 4)"
echo "  API:        $API_FILES (가중치 3)"
echo "  비즈니스:   $BUSINESS_FILES (가중치 2)"
echo "  설정:       $CONFIG_FILES (가중치 2)"
echo "  테스트:     $TEST_FILES (가중치 1)"
echo "  문서:       $DOC_FILES (가중치 0)"
echo ""
echo "--------------------------------------------"
echo " 종합 위험도 점수: $SCORE"
echo " 위험 등급: $RISK_LEVEL"
echo " 권장 조치: $RISK_ACTION"
echo "--------------------------------------------"

if [ -n "$SECURITY_ALERT" ]; then
  echo ""
  echo "[보안 경고] 다음 보안 관련 파일이 변경되었습니다:"
  echo -e "$SECURITY_ALERT"
fi

if [ "$CRITICAL_DETECTED" = true ]; then
  echo "[에스컬레이션] Critical 보안 파일 변경 감지. 보안팀 승인 필수."
fi

# --- JSON 출력 (선택) ---
if [ "$OUTPUT_FORMAT" = "json" ]; then
  cat <<JSONEOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "comparison": "$BASE_BRANCH...$HEAD_REF",
  "totalFiles": $TOTAL_FILES,
  "score": $SCORE,
  "riskLevel": "$RISK_LEVEL",
  "action": "$RISK_ACTION",
  "categories": {
    "security": $SECURITY_FILES,
    "infrastructure": $INFRA_FILES,
    "database": $DB_FILES,
    "api": $API_FILES,
    "business": $BUSINESS_FILES,
    "config": $CONFIG_FILES,
    "test": $TEST_FILES,
    "documentation": $DOC_FILES
  },
  "criticalFilesDetected": $CRITICAL_DETECTED
}
JSONEOF
fi
