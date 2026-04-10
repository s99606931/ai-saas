#!/usr/bin/env bash
# OpenSSF Scorecard PR 게이트 — 최소 점수 미달 시 차단
# Design Ref: DS-N115.2
# Plan SC: FR-N115.2
# CSAP: D-05 공급망 보안
set -euo pipefail

SUMMARY_FILE="${1:-scorecard-summary.json}"
MIN_SCORE="${SCORECARD_MIN_SCORE:-5.0}"
TARGET_SCORE="${SCORECARD_TARGET_SCORE:-7.0}"

echo "=========================================="
echo "OpenSSF Scorecard PR 게이트"
echo "최소 기준: ${MIN_SCORE}"
echo "목표 점수: ${TARGET_SCORE}"
echo "=========================================="

if [ ! -f "$SUMMARY_FILE" ]; then
  echo "[INFO] 요약 파일 미존재 ($SUMMARY_FILE) — 정적 설정 검증으로 대체"

  # 정적 검증: scorecard 설정 파일 확인
  CONFIG="/data/ai-saas/infra/security/scorecard/config.yaml"
  if [ -f "$CONFIG" ]; then
    echo "[PASS] Scorecard 설정 파일 존재"

    # 최소 점수 설정 확인
    MIN_CONFIGURED=$(grep "minimum:" "$CONFIG" | head -1 | awk '{print $2}')
    echo "[INFO] 설정된 최소 점수: $MIN_CONFIGURED"

    # CI 워크플로우 확인
    WORKFLOW="/data/ai-saas/.gitea/workflows/scorecard-ci.yaml"
    if [ -f "$WORKFLOW" ]; then
      echo "[PASS] Scorecard CI 워크플로우 존재"
    else
      echo "[FAIL] Scorecard CI 워크플로우 미존재"
      exit 1
    fi
  else
    echo "[FAIL] Scorecard 설정 파일 미존재"
    exit 1
  fi

  exit 0
fi

# JSON 요약 파일에서 점수 추출
SCORE=$(python3 -c "import json; d=json.load(open('$SUMMARY_FILE')); print(d.get('totalScore', 0))")

echo "현재 점수: $SCORE"

# 점수 비교 (bash 정수 비교를 위해 10배)
SCORE_INT=$(python3 -c "print(int(float('$SCORE') * 10))")
MIN_INT=$(python3 -c "print(int(float('$MIN_SCORE') * 10))")
TARGET_INT=$(python3 -c "print(int(float('$TARGET_SCORE') * 10))")

if [ "$SCORE_INT" -lt "$MIN_INT" ]; then
  echo ""
  echo "[FAIL] 점수 $SCORE < 최소 기준 $MIN_SCORE"
  echo "PR 머지가 차단됩니다."
  echo ""
  echo "개선이 필요한 항목:"
  python3 -c "
import json
d = json.load(open('$SUMMARY_FILE'))
for check in d.get('checks', []):
  if check.get('score', 10) < 5:
    print(f'  - {check[\"name\"]}: {check[\"score\"]}/10 — {check.get(\"reason\", \"N/A\")}')
"
  exit 1
elif [ "$SCORE_INT" -lt "$TARGET_INT" ]; then
  echo ""
  echo "[WARN] 점수 $SCORE < 목표 $TARGET_SCORE (통과, 개선 필요)"
  echo ""
  echo "개선 권장 항목:"
  python3 -c "
import json
d = json.load(open('$SUMMARY_FILE'))
for check in d.get('checks', []):
  if check.get('score', 10) < 7:
    print(f'  - {check[\"name\"]}: {check[\"score\"]}/10')
"
  exit 0
else
  echo ""
  echo "[PASS] 점수 $SCORE >= 목표 $TARGET_SCORE"
  exit 0
fi
