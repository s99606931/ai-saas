#!/bin/bash
# OSCAL Component Definition 검증 스크립트
# Plan SC: FR-CSAP3.3
# Design Ref: MTU-CSAP3 Design 3.1
#
# 사용법: ./scripts/oscal-validate.sh
# 사전 요구사항: jq (필수), oscal-cli (선택)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OSCAL_FILE="${PROJECT_ROOT}/docs/framework/02-csap/oscal/component-definition.json"
EXPECTED_CONTROLS=79

echo "============================================"
echo "  OSCAL Component Definition 검증"
echo "  대상: ${OSCAL_FILE}"
echo "  기준: CSAP 표준등급 ${EXPECTED_CONTROLS}항목"
echo "============================================"
echo ""

# 1단계: 파일 존재 확인
echo "[1/5] 파일 존재 확인..."
if [ ! -f "$OSCAL_FILE" ]; then
  echo "  ERROR: 파일이 존재하지 않습니다: $OSCAL_FILE"
  exit 1
fi
echo "  PASS: 파일 존재 확인"
echo ""

# 2단계: JSON 구문 검증
echo "[2/5] JSON 구문 검증..."
if ! command -v jq &> /dev/null; then
  echo "  ERROR: jq가 설치되어 있지 않습니다."
  echo "  설치: sudo apt-get install jq (Ubuntu) / brew install jq (macOS)"
  exit 1
fi

if jq empty "$OSCAL_FILE" 2>/dev/null; then
  echo "  PASS: JSON 구문 유효"
else
  echo "  FAIL: JSON 구문 오류"
  exit 1
fi
echo ""

# 3단계: OSCAL 필수 필드 확인
echo "[3/5] OSCAL 필수 필드 확인..."
OSCAL_VERSION=$(jq -r '.["component-definition"].metadata["oscal-version"] // "없음"' "$OSCAL_FILE")
TITLE=$(jq -r '.["component-definition"].metadata.title // "없음"' "$OSCAL_FILE")
UUID=$(jq -r '.["component-definition"].uuid // "없음"' "$OSCAL_FILE")

echo "  OSCAL 버전: $OSCAL_VERSION"
echo "  문서 제목: $TITLE"
echo "  문서 UUID: $UUID"

if [ "$OSCAL_VERSION" = "없음" ] || [ "$TITLE" = "없음" ] || [ "$UUID" = "없음" ]; then
  echo "  FAIL: 필수 필드 누락"
  exit 1
fi
echo "  PASS: 필수 필드 확인"
echo ""

# 4단계: 통제항목 전수 확인
echo "[4/5] 통제항목 전수 확인..."
CONTROL_COUNT=$(jq '[.["component-definition"].components[]?.["control-implementations"][]?.["implemented-requirements"][]?] | length' "$OSCAL_FILE")

echo "  매핑된 통제항목: ${CONTROL_COUNT} / ${EXPECTED_CONTROLS}"

if [ "$CONTROL_COUNT" -ge "$EXPECTED_CONTROLS" ]; then
  echo "  PASS: ${EXPECTED_CONTROLS}항목 전수 매핑 확인"
else
  echo "  FAIL: ${EXPECTED_CONTROLS}항목 미달 (${CONTROL_COUNT}항목만 매핑)"
  exit 1
fi
echo ""

# 5단계: 구현 상태별 통계
echo "[5/5] 구현 상태별 통계..."
echo ""
jq -r '
  [.["component-definition"].components[]?.["control-implementations"][]?.["implemented-requirements"][]?.props[]?
    | select(.name == "implementation-status")
    | .value
  ] | group_by(.)
    | map("  " + .[0] + ": " + (length | tostring) + "항목")
    | .[]
' "$OSCAL_FILE"
echo ""

# oscal-cli 검증 (설치된 경우)
if command -v oscal-cli &> /dev/null; then
  echo "[추가] oscal-cli 스키마 검증..."
  if oscal-cli validate "$OSCAL_FILE"; then
    echo "  PASS: oscal-cli 스키마 검증 통과"
  else
    echo "  WARN: oscal-cli 스키마 검증 실패 (JSON 구문은 유효)"
  fi
  echo ""
else
  echo "[INFO] oscal-cli 미설치. JSON 구문 + 구조 검증만 수행."
  echo "[INFO] 설치 방법: docs/framework/02-csap/oscal/validation-guide.md 참조"
  echo ""
fi

# 결과 요약
echo "============================================"
echo "  검증 결과: PASS"
echo "  통제항목: ${CONTROL_COUNT}/${EXPECTED_CONTROLS}"
echo "  OSCAL 버전: ${OSCAL_VERSION}"
echo "============================================"
