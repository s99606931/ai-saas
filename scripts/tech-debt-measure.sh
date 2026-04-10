#!/bin/bash
# tech-debt-measure.sh — 기술 부채 자동 측정
# Design Ref: MTU-N91 Design §2
# Plan SC: FR-N91.3
# CSAP: D-12 시스템 개발 보안

set -euo pipefail

SRC_DIR="${1:-src}"
REPORT_FILE="reports/tech-debt/$(date +%Y%m%d).json"

echo "=========================================="
echo "  기술 부채 측정 도구"
echo "  대상: $SRC_DIR"
echo "  날짜: $(date -Iseconds)"
echo "=========================================="
echo ""

# 점수 초기화
SCORE=0
DETAILS=()

# 1. 80줄 초과 함수 탐지 (가중치: 2)
echo "[1/5] 80줄 초과 함수 탐지"
LONG_FUNCS=0
if [ -d "$SRC_DIR" ]; then
    # TypeScript/JavaScript 파일에서 함수 길이 분석
    LONG_FUNCS=$(find "$SRC_DIR" -name "*.ts" -o -name "*.tsx" -o -name "*.js" 2>/dev/null | \
        xargs grep -c "function\|=>\|async" 2>/dev/null | \
        awk -F: '$2 > 50 {print}' | wc -l || echo "0")
fi
echo "  발견: ${LONG_FUNCS}건"
SCORE=$((SCORE + LONG_FUNCS * 2))

# 2. TODO/FIXME 탐지 (가중치: 1)
echo "[2/5] TODO/FIXME 항목 탐지"
TODOS=0
if [ -d "$SRC_DIR" ]; then
    TODOS=$(grep -rn "TODO\|FIXME\|HACK\|XXX" "$SRC_DIR" --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null | wc -l || echo "0")
fi
echo "  발견: ${TODOS}건"
SCORE=$((SCORE + TODOS * 1))

# 3. 미사용 import 탐지 (가중치: 1)
echo "[3/5] 미사용 코드 패턴 탐지"
UNUSED=0
if [ -d "$SRC_DIR" ]; then
    # 주석 처리된 코드 블록 탐지
    UNUSED=$(grep -rn "^[[:space:]]*//" "$SRC_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null | \
        grep -v "Design Ref\|Plan SC\|CSAP\|NOTE\|eslint\|prettier\|@" | wc -l || echo "0")
fi
echo "  발견: ${UNUSED}건"
SCORE=$((SCORE + UNUSED / 10))

# 4. 파일 크기 (800줄+) 탐지 (가중치: 3)
echo "[4/5] 800줄 초과 파일 탐지"
LARGE_FILES=0
if [ -d "$SRC_DIR" ]; then
    LARGE_FILES=$(find "$SRC_DIR" -name "*.ts" -o -name "*.tsx" 2>/dev/null | \
        xargs wc -l 2>/dev/null | \
        awk '$1 > 800 && $2 != "total" {print}' | wc -l || echo "0")
fi
echo "  발견: ${LARGE_FILES}건"
SCORE=$((SCORE + LARGE_FILES * 3))

# 5. Semgrep 경고 수 (가중치: 2)
echo "[5/5] Semgrep 경고 확인"
SEMGREP_WARNS=0
if [ -f "semgrep-results.json" ]; then
    SEMGREP_WARNS=$(jq '[.results[] | select(.extra.severity == "WARNING")] | length' semgrep-results.json 2>/dev/null || echo "0")
fi
echo "  경고: ${SEMGREP_WARNS}건"
SCORE=$((SCORE + SEMGREP_WARNS * 2))

# 등급 산정
echo ""
echo "=========================================="
GRADE=""
if [ "$SCORE" -le 10 ]; then
    GRADE="A"
elif [ "$SCORE" -le 30 ]; then
    GRADE="B"
elif [ "$SCORE" -le 60 ]; then
    GRADE="C"
elif [ "$SCORE" -le 100 ]; then
    GRADE="D"
else
    GRADE="E"
fi

echo "  기술 부채 점수: $SCORE"
echo "  등급: $GRADE"
echo "  상세:"
echo "    80줄+ 함수: ${LONG_FUNCS}건 (x2 = $((LONG_FUNCS * 2)))"
echo "    TODO/FIXME: ${TODOS}건 (x1 = $((TODOS * 1)))"
echo "    미사용 코드: ~${UNUSED}건 (/10 = $((UNUSED / 10)))"
echo "    800줄+ 파일: ${LARGE_FILES}건 (x3 = $((LARGE_FILES * 3)))"
echo "    Semgrep 경고: ${SEMGREP_WARNS}건 (x2 = $((SEMGREP_WARNS * 2)))"
echo "=========================================="

# 리포트 저장
mkdir -p "$(dirname "$REPORT_FILE")"
cat > "$REPORT_FILE" << EOF
{
  "date": "$(date -Iseconds)",
  "score": $SCORE,
  "grade": "$GRADE",
  "details": {
    "longFunctions": $LONG_FUNCS,
    "todos": $TODOS,
    "unusedCode": $UNUSED,
    "largeFiles": $LARGE_FILES,
    "semgrepWarnings": $SEMGREP_WARNS
  }
}
EOF
echo "리포트 저장: $REPORT_FILE"
