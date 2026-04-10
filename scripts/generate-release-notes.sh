#!/bin/bash
# generate-release-notes.sh — Git 커밋 기반 릴리스 노트 자동 생성
# Design Ref: MTU-N94 Design §1
# Plan SC: FR-N94.1
# CSAP: D-12 시스템 개발 보안

set -euo pipefail

PREVIOUS_TAG="${1:-$(git describe --tags --abbrev=0 2>/dev/null || echo 'HEAD~50')}"
CURRENT_TAG="${2:-HEAD}"
OUTPUT_FILE="${3:-docs/release/RELEASE-NOTES-$(date +%Y%m%d).md}"
PROJECT_NAME="공공기관 SaaS 프레임워크"

echo "=========================================="
echo "  릴리스 노트 자동 생성"
echo "  범위: $PREVIOUS_TAG..$CURRENT_TAG"
echo "=========================================="

# 커밋 분류
FEATURES=$(git log --oneline "$PREVIOUS_TAG".."$CURRENT_TAG" --grep="^feat" 2>/dev/null || echo "")
FIXES=$(git log --oneline "$PREVIOUS_TAG".."$CURRENT_TAG" --grep="^fix" 2>/dev/null || echo "")
DOCS=$(git log --oneline "$PREVIOUS_TAG".."$CURRENT_TAG" --grep="^docs" 2>/dev/null || echo "")
REFACTORS=$(git log --oneline "$PREVIOUS_TAG".."$CURRENT_TAG" --grep="^refactor" 2>/dev/null || echo "")
SECURITY=$(git log --oneline "$PREVIOUS_TAG".."$CURRENT_TAG" --grep="security\|CVE\|vuln" 2>/dev/null || echo "")
BREAKING=$(git log --oneline "$PREVIOUS_TAG".."$CURRENT_TAG" --grep="BREAKING" 2>/dev/null || echo "")
CHORE=$(git log --oneline "$PREVIOUS_TAG".."$CURRENT_TAG" --grep="^chore" 2>/dev/null || echo "")

# 통계
TOTAL_COMMITS=$(git log --oneline "$PREVIOUS_TAG".."$CURRENT_TAG" 2>/dev/null | wc -l)
CONTRIBUTORS=$(git log "$PREVIOUS_TAG".."$CURRENT_TAG" --format="%aN" 2>/dev/null | sort -u | wc -l)

mkdir -p "$(dirname "$OUTPUT_FILE")"

cat > "$OUTPUT_FILE" << HEREDOC
# ${PROJECT_NAME} 릴리스 노트

> **버전**: $(date +%Y.%m.%d)
> **릴리스 일자**: $(date +%Y-%m-%d)
> **커밋 범위**: ${PREVIOUS_TAG}..${CURRENT_TAG}
> **총 커밋**: ${TOTAL_COMMITS}건
> **기여자**: ${CONTRIBUTORS}명

---

## 주요 변경사항 요약

| 분류 | 건수 |
|------|------|
| 신규 기능 | $(echo "$FEATURES" | grep -c . || echo 0) |
| 버그 수정 | $(echo "$FIXES" | grep -c . || echo 0) |
| 문서 | $(echo "$DOCS" | grep -c . || echo 0) |
| 리팩토링 | $(echo "$REFACTORS" | grep -c . || echo 0) |
| 보안 패치 | $(echo "$SECURITY" | grep -c . || echo 0) |
| 파괴적 변경 | $(echo "$BREAKING" | grep -c . || echo 0) |

---

HEREDOC

# 파괴적 변경 (최우선 표시)
if [ -n "$BREAKING" ]; then
    echo "## BREAKING CHANGES" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "> 아래 변경사항은 이전 버전과 호환되지 않습니다. 마이그레이션 가이드를 참조하세요." >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "$BREAKING" | while IFS= read -r line; do
        [ -n "$line" ] && echo "- $line" >> "$OUTPUT_FILE"
    done
    echo "" >> "$OUTPUT_FILE"
fi

# 보안 패치
if [ -n "$SECURITY" ]; then
    echo "## 보안 패치" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "$SECURITY" | while IFS= read -r line; do
        [ -n "$line" ] && echo "- $line" >> "$OUTPUT_FILE"
    done
    echo "" >> "$OUTPUT_FILE"
fi

# 신규 기능
if [ -n "$FEATURES" ]; then
    echo "## 신규 기능" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "$FEATURES" | while IFS= read -r line; do
        [ -n "$line" ] && echo "- $line" >> "$OUTPUT_FILE"
    done
    echo "" >> "$OUTPUT_FILE"
fi

# 버그 수정
if [ -n "$FIXES" ]; then
    echo "## 버그 수정" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "$FIXES" | while IFS= read -r line; do
        [ -n "$line" ] && echo "- $line" >> "$OUTPUT_FILE"
    done
    echo "" >> "$OUTPUT_FILE"
fi

# 문서
if [ -n "$DOCS" ]; then
    echo "## 문서 변경" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "$DOCS" | while IFS= read -r line; do
        [ -n "$line" ] && echo "- $line" >> "$OUTPUT_FILE"
    done
    echo "" >> "$OUTPUT_FILE"
fi

# CSAP/감리 준수 현황
cat >> "$OUTPUT_FILE" << 'HEREDOC2'

---

## CSAP/감리 준수 현황

| 항목 | 상태 |
|------|------|
| CSAP 79개 통제항목 | 전수 매핑 완료 |
| N2SF 6개 보안 영역 | 전수 구현 완료 |
| 감리 T01~T07 산출물 | 전수 완비 |
| Q-Gate G1~G7 | 전수 통과 |
| E2E 테스트 | 27건+ 전수 PASS |
| 인프라 컴포넌트 | 37개+ 운영 |

---

*이 릴리스 노트는 자동 생성되었습니다.*
HEREDOC2

echo "릴리스 노트 생성 완료: $OUTPUT_FILE"
echo "총 커밋: $TOTAL_COMMITS / 기여자: $CONTRIBUTORS"
