#!/bin/bash
# =============================================================================
# SLSA L3 빌드 증명 검증 스크립트
# Design Ref: MTU-N46 Design §아키텍처
# Plan SC: FR-N46.5, FR-N46.7
#
# 사용법: bash scripts/verify-slsa.sh <image_ref_with_digest>
# 또는:   bash scripts/verify-slsa.sh --file <provenance.json>
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COSIGN_PUB="$PROJECT_DIR/infra/cosign/cosign.pub"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
TOTAL=0

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_pass()  { echo -e "${GREEN}  [PASS]${NC} $1"; ((PASS++)) || true; }
log_fail()  { echo -e "${RED}  [FAIL]${NC} $1"; ((FAIL++)) || true; }
log_check() { echo -e "\n${BLUE}[CHECK $((++TOTAL))]${NC} $1"; }

# =========================================================================
# 모드 결정
# =========================================================================
if [ "${1:-}" = "--file" ]; then
    # 로컬 파일 검증 모드
    PROVENANCE_FILE="${2:?Provenance JSON 파일 경로가 필요합니다}"
    MODE="file"
elif [ -n "${1:-}" ]; then
    # 이미지 검증 모드
    IMAGE_REF="$1"
    MODE="image"
else
    echo "사용법:"
    echo "  $0 <image_ref>              이미지 증명 검증"
    echo "  $0 --file <provenance.json> 로컬 파일 검증"
    exit 1
fi

echo "========================================="
echo " SLSA L3 빌드 증명 검증"
echo "========================================="

# =========================================================================
# 파일 모드 검증
# =========================================================================
if [ "$MODE" = "file" ]; then
    log_check "Provenance 파일 존재 확인"
    if [ -f "$PROVENANCE_FILE" ]; then
        log_pass "파일 존재: $PROVENANCE_FILE"
    else
        log_fail "파일 없음: $PROVENANCE_FILE"
        exit 1
    fi

    log_check "JSON 유효성"
    if python3 -c "import json; json.load(open('$PROVENANCE_FILE'))" 2>/dev/null; then
        log_pass "유효한 JSON"
    else
        log_fail "잘못된 JSON"
    fi

    log_check "in-toto Statement 형식"
    TYPE=$(python3 -c "import json; d=json.load(open('$PROVENANCE_FILE')); print(d.get('_type',''))" 2>/dev/null)
    if [ "$TYPE" = "https://in-toto.io/Statement/v1" ]; then
        log_pass "in-toto Statement v1 형식"
    else
        log_fail "in-toto Statement 형식 아님 (타입: $TYPE)"
    fi

    log_check "SLSA Provenance predicate 타입"
    PRED_TYPE=$(python3 -c "import json; d=json.load(open('$PROVENANCE_FILE')); print(d.get('predicateType',''))" 2>/dev/null)
    if [ "$PRED_TYPE" = "https://slsa.dev/provenance/v1" ]; then
        log_pass "SLSA Provenance v1"
    else
        log_fail "잘못된 predicate 타입: $PRED_TYPE"
    fi

    log_check "Subject (빌드 대상) 존재"
    SUBJECT_COUNT=$(python3 -c "import json; d=json.load(open('$PROVENANCE_FILE')); print(len(d.get('subject',[])))" 2>/dev/null)
    if [ "$SUBJECT_COUNT" -ge 1 ]; then
        log_pass "Subject $SUBJECT_COUNT개"
    else
        log_fail "Subject 없음"
    fi

    log_check "빌드 타입 확인"
    BUILD_TYPE=$(python3 -c "import json; d=json.load(open('$PROVENANCE_FILE')); print(d['predicate']['buildDefinition']['buildType'])" 2>/dev/null)
    if [ -n "$BUILD_TYPE" ]; then
        log_pass "빌드 타입: $BUILD_TYPE"
    else
        log_fail "빌드 타입 누락"
    fi

    log_check "빌더 ID 확인"
    BUILDER_ID=$(python3 -c "import json; d=json.load(open('$PROVENANCE_FILE')); print(d['predicate']['runDetails']['builder']['id'])" 2>/dev/null)
    if [ -n "$BUILDER_ID" ]; then
        log_pass "빌더 ID: $BUILDER_ID"
    else
        log_fail "빌더 ID 누락"
    fi

    log_check "Invocation ID 확인"
    INV_ID=$(python3 -c "import json; d=json.load(open('$PROVENANCE_FILE')); print(d['predicate']['runDetails']['metadata']['invocationId'])" 2>/dev/null)
    if [ -n "$INV_ID" ]; then
        log_pass "Invocation ID: $INV_ID"
    else
        log_fail "Invocation ID 누락"
    fi

    log_check "타임스탬프 확인"
    STARTED=$(python3 -c "import json; d=json.load(open('$PROVENANCE_FILE')); print(d['predicate']['runDetails']['metadata']['startedOn'])" 2>/dev/null)
    if [ -n "$STARTED" ]; then
        log_pass "시작 시간: $STARTED"
    else
        log_fail "타임스탬프 누락"
    fi

    log_check "소스 커밋 해시 확인"
    COMMIT=$(python3 -c "import json; d=json.load(open('$PROVENANCE_FILE')); print(d['predicate']['buildDefinition']['externalParameters'].get('commit',''))" 2>/dev/null)
    if [ -n "$COMMIT" ] && [ "$COMMIT" != "unknown" ]; then
        log_pass "커밋: ${COMMIT:0:12}"
    else
        log_fail "소스 커밋 정보 없음"
    fi
fi

# =========================================================================
# 이미지 모드 검증
# =========================================================================
if [ "$MODE" = "image" ]; then
    log_check "Cosign 도구 확인"
    if command -v cosign &>/dev/null; then
        log_pass "Cosign 설치됨: $(cosign version 2>&1 | head -1)"
    else
        log_fail "Cosign 미설치"
        exit 1
    fi

    log_check "공개키 확인"
    if [ -f "$COSIGN_PUB" ]; then
        log_pass "공개키 존재: $COSIGN_PUB"
    else
        log_fail "공개키 없음: $COSIGN_PUB"
    fi

    log_check "이미지 서명 검증"
    if cosign verify --key "$COSIGN_PUB" "$IMAGE_REF" 2>/dev/null; then
        log_pass "이미지 서명 유효"
    else
        log_fail "이미지 서명 검증 실패"
    fi

    log_check "SLSA Provenance Attestation 검증"
    if cosign verify-attestation --key "$COSIGN_PUB" --type slsaprovenance "$IMAGE_REF" 2>/dev/null; then
        log_pass "SLSA Provenance 증명 유효"
    else
        log_fail "SLSA Provenance 증명 검증 실패"
    fi
fi

# =========================================================================
# 결과 요약
# =========================================================================
echo ""
echo "========================================="
echo " SLSA L3 검증 결과"
echo "========================================="
echo -e " 전체: ${TOTAL}건"
echo -e " ${GREEN}PASS${NC}: ${PASS}건"
echo -e " ${RED}FAIL${NC}: ${FAIL}건"
echo "========================================="

if [ "$FAIL" -eq 0 ]; then
    echo -e "${GREEN}SLSA L3 검증 통과${NC}"
    exit 0
else
    echo -e "${RED}SLSA L3 검증 실패 (${FAIL}건)${NC}"
    exit 1
fi
