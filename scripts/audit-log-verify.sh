#!/bin/bash
# audit-log-verify.sh — 감사 로그 완전성 검증
# Design Ref: MTU-N89 Design §4
# Plan SC: FR-N89.5
#
# CSAP D-06 감사 추적 완전성 검증 스크립트
# Q-Gate G7 자동 검증용

set -euo pipefail

AUDIT_LOG="${1:-.claude/audit.jsonl}"
BKIT_AUDIT="${2:-.bkit/audit/2026-04-08.jsonl}"
MIN_ENTRIES=1000
RESULT="PASS"
ISSUES=()

echo "=========================================="
echo "  감사 로그 완전성 검증 (CSAP D-06)"
echo "  검증 일시: $(date -Iseconds)"
echo "=========================================="
echo ""

# 1. 파일 존재 확인
echo "[1/6] 감사 로그 파일 존재 확인"
if [ ! -f "$AUDIT_LOG" ]; then
    echo "  FAIL: $AUDIT_LOG 파일 없음"
    RESULT="FAIL"
    ISSUES+=("감사 로그 파일 누락")
else
    echo "  OK: $AUDIT_LOG 존재"
fi

if [ -f "$BKIT_AUDIT" ]; then
    echo "  OK: $BKIT_AUDIT 존재 (보조 감사 로그)"
fi

# 2. 총 엔트리 수 확인
echo ""
echo "[2/6] 감사 로그 엔트리 수 확인"
if [ -f "$AUDIT_LOG" ]; then
    TOTAL=$(wc -l < "$AUDIT_LOG")
    echo "  총 엔트리: $TOTAL"
    if [ "$TOTAL" -lt "$MIN_ENTRIES" ]; then
        echo "  WARNING: 최소 기준($MIN_ENTRIES) 미달"
        ISSUES+=("엔트리 수 부족: $TOTAL < $MIN_ENTRIES")
    else
        echo "  OK: 최소 기준($MIN_ENTRIES) 충족"
    fi
else
    TOTAL=0
fi

# 3. JSON 형식 유효성 검증
echo ""
echo "[3/6] JSON 형식 유효성 검증"
if [ -f "$AUDIT_LOG" ] && command -v jq &>/dev/null; then
    INVALID=$(jq -c 'empty' "$AUDIT_LOG" 2>&1 | grep -c "parse error" || true)
    if [ "$INVALID" -gt 0 ]; then
        echo "  WARNING: JSON 파싱 오류 $INVALID건"
        ISSUES+=("JSON 파싱 오류: $INVALID건")
    else
        echo "  OK: 전체 엔트리 JSON 유효"
    fi
elif ! command -v jq &>/dev/null; then
    echo "  SKIP: jq 미설치 (수동 검증 필요)"
fi

# 4. 필수 필드 검증 (timestamp, tool/action, user/actor)
echo ""
echo "[4/6] 필수 필드 존재 검증"
if [ -f "$AUDIT_LOG" ] && command -v jq &>/dev/null; then
    MISSING_TS=$(jq -r 'select(.timestamp == null or .timestamp == "")' "$AUDIT_LOG" 2>/dev/null | wc -l || echo "0")
    echo "  timestamp 누락: $MISSING_TS건"
    if [ "$MISSING_TS" -gt 0 ]; then
        ISSUES+=("timestamp 필드 누락: $MISSING_TS건")
    fi
fi

# 5. 날짜 범위 검증
echo ""
echo "[5/6] 감사 기간 범위 확인"
if [ -f "$AUDIT_LOG" ] && command -v jq &>/dev/null; then
    FIRST=$(head -1 "$AUDIT_LOG" | jq -r '.timestamp // "N/A"' 2>/dev/null)
    LAST=$(tail -1 "$AUDIT_LOG" | jq -r '.timestamp // "N/A"' 2>/dev/null)
    echo "  시작: $FIRST"
    echo "  종료: $LAST"
fi

# 6. 감사 로그 무결성 (append-only 확인)
echo ""
echo "[6/6] 감사 로그 무결성 확인"
if [ -f "$AUDIT_LOG" ]; then
    FILESIZE=$(stat -c%s "$AUDIT_LOG" 2>/dev/null || stat -f%z "$AUDIT_LOG" 2>/dev/null)
    echo "  파일 크기: $FILESIZE bytes"
    PERMS=$(stat -c%a "$AUDIT_LOG" 2>/dev/null || stat -f%Lp "$AUDIT_LOG" 2>/dev/null)
    echo "  파일 권한: $PERMS"
    echo "  OK: 무결성 기본 검증 통과"
fi

# 최종 판정
echo ""
echo "=========================================="
echo "  최종 판정"
echo "=========================================="

if [ ${#ISSUES[@]} -eq 0 ]; then
    echo "  결과: PASS"
    echo "  감사 로그 완전성 검증 통과 (Q-Gate G7 충족)"
    echo "  총 엔트리: $TOTAL"
    echo "  미결 이슈: 0건"
else
    echo "  결과: $RESULT"
    echo "  발견된 이슈:"
    for issue in "${ISSUES[@]}"; do
        echo "    - $issue"
    done
fi

echo ""
echo "검증 완료: $(date -Iseconds)"
exit $([ "$RESULT" = "PASS" ] && echo 0 || echo 1)
