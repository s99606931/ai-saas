#!/usr/bin/env bash
# Design Ref: MTU-N84 §Design Anchor
# Plan SC: FR-N84.3, FR-N84.5
# CSAP 증거 완전성 및 무결성 검증
set -euo pipefail

DATE=${1:-$(date +%Y-%m-%d)}
BASE_DIR="/data/ai-saas/evidence/${DATE}"

echo "============================================"
echo " CSAP 증거 완전성 및 무결성 검증"
echo " 날짜: ${DATE}"
echo "============================================"
echo ""

PASS=0
FAIL=0

# 1. 디렉토리 존재 확인
if [ ! -d "${BASE_DIR}" ]; then
  echo "[FAIL] 증거 디렉토리 없음: ${BASE_DIR}"
  echo "먼저 csap-evidence-collect.sh를 실행하십시오."
  exit 1
fi

# 2. 필수 통제 영역 존재 확인
REQUIRED_CONTROLS="D-06 D-08 D-09 D-10 D-12 D-13"
for ctrl in $REQUIRED_CONTROLS; do
  if [ -d "${BASE_DIR}/${ctrl}" ]; then
    FILE_COUNT=$(find "${BASE_DIR}/${ctrl}" -type f | wc -l)
    echo "[PASS] ${ctrl}: ${FILE_COUNT}개 증거 파일"
    PASS=$((PASS + 1))
  else
    echo "[FAIL] ${ctrl}: 증거 디렉토리 없음"
    FAIL=$((FAIL + 1))
  fi
done

# 3. 무결성 해시 검증
echo ""
echo "무결성 해시 검증..."
if [ -f "${BASE_DIR}/integrity.sha256" ]; then
  HASH_TOTAL=$(wc -l < "${BASE_DIR}/integrity.sha256")
  HASH_OK=$(cd / && sha256sum -c "${BASE_DIR}/integrity.sha256" 2>/dev/null | grep -c "OK" || echo "0")
  if [ "$HASH_OK" -eq "$HASH_TOTAL" ]; then
    echo "[PASS] 무결성 해시 검증: ${HASH_OK}/${HASH_TOTAL} 통과"
    PASS=$((PASS + 1))
  else
    echo "[FAIL] 무결성 해시 검증: ${HASH_OK}/${HASH_TOTAL} 통과"
    FAIL=$((FAIL + 1))
  fi
else
  echo "[FAIL] 무결성 해시 파일 없음"
  FAIL=$((FAIL + 1))
fi

# 4. 매니페스트 검증
echo ""
if [ -f "${BASE_DIR}/manifest.json" ]; then
  echo "[PASS] 매니페스트 파일 존재"
  PASS=$((PASS + 1))
  python3 -c "import json; json.load(open('${BASE_DIR}/manifest.json'))" 2>/dev/null && {
    echo "[PASS] 매니페스트 JSON 유효"
    PASS=$((PASS + 1))
  } || {
    echo "[FAIL] 매니페스트 JSON 형식 오류"
    FAIL=$((FAIL + 1))
  }
else
  echo "[FAIL] 매니페스트 파일 없음"
  FAIL=$((FAIL + 1))
fi

# 결과
echo ""
echo "============================================"
echo " 검증 결과: 통과 ${PASS} / 실패 ${FAIL}"
echo "============================================"
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
