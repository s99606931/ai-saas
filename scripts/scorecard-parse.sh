#!/bin/bash
# scorecard-parse.sh — OpenSSF Scorecard 결과 파싱 및 분석
# Design Ref: MTU-N90 Design §3
# Plan SC: FR-N90.3
# CSAP: D-05 공급망 보안

set -euo pipefail

RESULT_FILE="${1:-scorecard-results.json}"
THRESHOLD="${2:-7.0}"
HISTORY_DIR="reports/scorecard"

echo "=========================================="
echo "  OpenSSF Scorecard 결과 분석"
echo "  파일: $RESULT_FILE"
echo "  기준 점수: $THRESHOLD"
echo "=========================================="
echo ""

# 결과 파일 존재 확인
if [ ! -f "$RESULT_FILE" ]; then
    echo "ERROR: $RESULT_FILE 파일 없음"
    echo "  scorecard --local=. --format=json > $RESULT_FILE"
    exit 1
fi

# 총점 추출
TOTAL_SCORE=$(jq '.score // 0' "$RESULT_FILE" 2>/dev/null)
echo "총점: $TOTAL_SCORE / 10"
echo ""

# 검사 항목별 결과
echo "--- 검사 항목별 결과 ---"
echo ""

CHECKS_TOTAL=$(jq '.checks | length // 0' "$RESULT_FILE" 2>/dev/null)
CHECKS_PASS=$(jq '[.checks[] | select(.score >= 7)] | length // 0' "$RESULT_FILE" 2>/dev/null)
CHECKS_WARN=$(jq '[.checks[] | select(.score >= 4 and .score < 7)] | length // 0' "$RESULT_FILE" 2>/dev/null)
CHECKS_FAIL=$(jq '[.checks[] | select(.score < 4)] | length // 0' "$RESULT_FILE" 2>/dev/null)

echo "전체: $CHECKS_TOTAL / 통과: $CHECKS_PASS / 경고: $CHECKS_WARN / 실패: $CHECKS_FAIL"
echo ""

# 항목별 상세
echo "--- 상세 결과 ---"
jq -r '.checks[] | "\(if .score >= 7 then "PASS" elif .score >= 4 then "WARN" else "FAIL" end) | \(.name): \(.score)/10 — \(.reason // "N/A")"' "$RESULT_FILE" 2>/dev/null || echo "(파싱 실패)"
echo ""

# CSAP 매핑 출력
echo "--- CSAP 통제항목 매핑 ---"
echo "  Binary-Artifacts    → D-05 공급망 보안"
echo "  Branch-Protection   → D-12 개발 보안"
echo "  Code-Review         → D-12 개발 보안"
echo "  Dependency-Update   → D-05 공급망 보안"
echo "  Pinned-Dependencies → D-05 공급망 보안"
echo "  SAST                → D-12 개발 보안"
echo "  Security-Policy     → D-01 정보보호 정책"
echo "  Signed-Releases     → D-09 암호화"
echo "  Token-Permissions   → D-08 접근 통제"
echo "  Vulnerabilities     → D-05 공급망 보안"
echo ""

# 개선 권장사항
echo "--- 개선 권장사항 ---"
jq -r '.checks[] | select(.score < 7) | "  [\(.name)] \(.score)/10: \(.documentation.short // "문서 참조")"' "$RESULT_FILE" 2>/dev/null || echo "  모든 항목 7점 이상 — 개선 불필요"
echo ""

# 이력 비교 (이전 결과 존재 시)
if [ -d "$HISTORY_DIR" ]; then
    PREV_FILE=$(ls -t "$HISTORY_DIR"/scorecard-*.json 2>/dev/null | head -1)
    if [ -n "$PREV_FILE" ] && [ "$PREV_FILE" != "$RESULT_FILE" ]; then
        PREV_SCORE=$(jq '.score // 0' "$PREV_FILE" 2>/dev/null)
        echo "--- 이력 비교 ---"
        echo "  이전 점수: $PREV_SCORE"
        echo "  현재 점수: $TOTAL_SCORE"
        DIFF=$(echo "$TOTAL_SCORE - $PREV_SCORE" | bc -l 2>/dev/null || echo "N/A")
        echo "  변동: $DIFF"
    fi
fi

# 최종 판정
echo ""
echo "=========================================="
if [ "$(echo "$TOTAL_SCORE >= $THRESHOLD" | bc -l 2>/dev/null || echo 0)" -eq 1 ]; then
    echo "  판정: PASS ($TOTAL_SCORE >= $THRESHOLD)"
    exit 0
else
    echo "  판정: FAIL ($TOTAL_SCORE < $THRESHOLD)"
    exit 1
fi
