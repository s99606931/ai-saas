#!/bin/bash
# =============================================================================
# SLSA L3 빌드 증명 테스트 스크립트
# Design Ref: MTU-N46 Design
# Plan SC: FR-N46.8
#
# 테스트: 증명 생성 → 서명 → 검증 전 주기
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PASS=0
FAIL=0
SKIP=0
TOTAL=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_test()  { echo -e "\n${BLUE}[TEST $((++TOTAL))]${NC} $1"; }
log_pass()  { echo -e "${GREEN}  [PASS]${NC} $1"; ((PASS++)) || true; }
log_fail()  { echo -e "${RED}  [FAIL]${NC} $1"; ((FAIL++)) || true; }
log_skip()  { echo -e "${YELLOW}  [SKIP]${NC} $1"; ((SKIP++)) || true; }

echo "========================================="
echo " MTU-N46: SLSA L3 빌드 증명 테스트"
echo "========================================="

# =========================================================================
# Phase 1: 산출물 존재 확인
# =========================================================================
log_test "SLSA L3 체크리스트 문서 존재"
if [ -f "$PROJECT_DIR/docs/security/slsa-l3-checklist.md" ]; then
    log_pass "slsa-l3-checklist.md 존재"
else
    log_fail "slsa-l3-checklist.md 없음"
fi

log_test "SLSA Provenance 워크플로우 존재"
if [ -f "$PROJECT_DIR/.gitea/workflows/slsa-provenance.yml" ]; then
    log_pass "slsa-provenance.yml 존재"
else
    log_fail "slsa-provenance.yml 없음"
fi

log_test "Kyverno 증명 검증 정책 존재"
if [ -f "$PROJECT_DIR/infra/kyverno/verify-provenance.yaml" ]; then
    log_pass "verify-provenance.yaml 존재"
else
    log_fail "verify-provenance.yaml 없음"
fi

log_test "증명 생성 스크립트 존재"
if [ -f "$PROJECT_DIR/scripts/generate-provenance.sh" ]; then
    log_pass "generate-provenance.sh 존재"
else
    log_fail "generate-provenance.sh 없음"
fi

log_test "검증 스크립트 존재"
if [ -f "$PROJECT_DIR/scripts/verify-slsa.sh" ]; then
    log_pass "verify-slsa.sh 존재"
else
    log_fail "verify-slsa.sh 없음"
fi

# =========================================================================
# Phase 2: 증명 생성 테스트
# =========================================================================
log_test "Provenance 생성 실행"
TEST_IMAGE="harbor.local/saas/test-image:v0.0.1"
TEST_DIGEST="sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

if bash "$PROJECT_DIR/scripts/generate-provenance.sh" "$TEST_IMAGE" "$TEST_DIGEST" > /tmp/slsa-gen-output.txt 2>&1; then
    log_pass "Provenance 생성 성공"
else
    log_fail "Provenance 생성 실패"
fi

log_test "생성된 Provenance 파일 확인"
PROV_FILE=$(ls -t "$PROJECT_DIR/.slsa/provenance-"*.json 2>/dev/null | head -1)
if [ -n "$PROV_FILE" ] && [ -f "$PROV_FILE" ]; then
    log_pass "파일 생성됨: $(basename "$PROV_FILE")"
else
    log_fail "Provenance 파일 없음"
    PROV_FILE=""
fi

# =========================================================================
# Phase 3: 증명 검증 테스트
# =========================================================================
if [ -n "$PROV_FILE" ]; then
    log_test "Provenance JSON 유효성"
    if python3 -c "import json; json.load(open('$PROV_FILE'))" 2>/dev/null; then
        log_pass "JSON 유효"
    else
        log_fail "JSON 무효"
    fi

    log_test "in-toto Statement v1 형식 확인"
    TYPE=$(python3 -c "import json; d=json.load(open('$PROV_FILE')); print(d.get('_type',''))" 2>/dev/null)
    if [ "$TYPE" = "https://in-toto.io/Statement/v1" ]; then
        log_pass "올바른 Statement 형식"
    else
        log_fail "잘못된 형식: $TYPE"
    fi

    log_test "SLSA Provenance predicate 타입 확인"
    PRED=$(python3 -c "import json; d=json.load(open('$PROV_FILE')); print(d.get('predicateType',''))" 2>/dev/null)
    if [ "$PRED" = "https://slsa.dev/provenance/v1" ]; then
        log_pass "올바른 predicate"
    else
        log_fail "잘못된 predicate: $PRED"
    fi

    log_test "Subject 이미지 참조 확인"
    SUBJ=$(python3 -c "import json; d=json.load(open('$PROV_FILE')); print(d['subject'][0]['name'])" 2>/dev/null)
    if [ "$SUBJ" = "$TEST_IMAGE" ]; then
        log_pass "이미지 참조 일치: $SUBJ"
    else
        log_fail "이미지 참조 불일치: $SUBJ"
    fi

    log_test "Subject 다이제스트 확인"
    DIGEST=$(python3 -c "import json; d=json.load(open('$PROV_FILE')); print(d['subject'][0]['digest']['sha256'])" 2>/dev/null)
    EXPECTED="${TEST_DIGEST#sha256:}"
    if [ "$DIGEST" = "$EXPECTED" ]; then
        log_pass "다이제스트 일치"
    else
        log_fail "다이제스트 불일치"
    fi

    log_test "빌드 타입 확인"
    BT=$(python3 -c "import json; d=json.load(open('$PROV_FILE')); print(d['predicate']['buildDefinition']['buildType'])" 2>/dev/null)
    if [ "$BT" = "https://gitea-actions/v1" ]; then
        log_pass "빌드 타입: $BT"
    else
        log_fail "잘못된 빌드 타입: $BT"
    fi

    log_test "빌더 ID 확인"
    BID=$(python3 -c "import json; d=json.load(open('$PROV_FILE')); print(d['predicate']['runDetails']['builder']['id'])" 2>/dev/null)
    if [ "$BID" = "https://gitea.local/actions/runner" ]; then
        log_pass "빌더 ID: $BID"
    else
        log_fail "빌더 ID 불일치: $BID"
    fi

    log_test "타임스탬프 존재 확인"
    TS=$(python3 -c "import json; d=json.load(open('$PROV_FILE')); print(d['predicate']['runDetails']['metadata']['startedOn'])" 2>/dev/null)
    if [ -n "$TS" ]; then
        log_pass "시작 시간: $TS"
    else
        log_fail "타임스탬프 누락"
    fi

    log_test "verify-slsa.sh --file 검증"
    if bash "$PROJECT_DIR/scripts/verify-slsa.sh" --file "$PROV_FILE" > /tmp/slsa-verify-output.txt 2>&1; then
        log_pass "검증 스크립트 통과"
    else
        log_fail "검증 스크립트 실패"
    fi
else
    for i in $(seq 1 8); do
        log_test "Provenance 내용 검증 (파일 없음으로 건너뜀)"
        log_skip "Provenance 파일 미생성"
    done
fi

# =========================================================================
# Phase 4: YAML 구문 검증
# =========================================================================
log_test "Kyverno 정책 YAML 구문 검증"
if python3 -c "import yaml; yaml.safe_load(open('$PROJECT_DIR/infra/kyverno/verify-provenance.yaml'))" 2>/dev/null; then
    log_pass "YAML 유효"
else
    log_fail "YAML 무효"
fi

log_test "워크플로우 YAML 구문 검증"
if python3 -c "import yaml; yaml.safe_load(open('$PROJECT_DIR/.gitea/workflows/slsa-provenance.yml'))" 2>/dev/null; then
    log_pass "YAML 유효"
else
    log_fail "YAML 무효"
fi

# =========================================================================
# Phase 5: CSAP 매핑 확인
# =========================================================================
log_test "CSAP D-12 매핑 확인 (체크리스트)"
if grep -q "D-12" "$PROJECT_DIR/docs/security/slsa-l3-checklist.md"; then
    log_pass "CSAP D-12 매핑 포함"
else
    log_fail "CSAP D-12 매핑 누락"
fi

log_test "CSAP D-09 매핑 확인 (암호화)"
if grep -q "D-09" "$PROJECT_DIR/docs/security/slsa-l3-checklist.md"; then
    log_pass "CSAP D-09 매핑 포함"
else
    log_fail "CSAP D-09 매핑 누락"
fi

log_test "Kyverno 정책 CSAP 라벨 확인"
if grep -q "csap.compliance" "$PROJECT_DIR/infra/kyverno/verify-provenance.yaml"; then
    log_pass "CSAP 컴플라이언스 라벨 포함"
else
    log_fail "CSAP 라벨 누락"
fi

# =========================================================================
# 정리
# =========================================================================
rm -rf "$PROJECT_DIR/.slsa" 2>/dev/null || true

# =========================================================================
# 결과 요약
# =========================================================================
echo ""
echo "========================================="
echo " SLSA L3 빌드 증명 테스트 결과"
echo "========================================="
echo -e " 전체: ${TOTAL}건"
echo -e " ${GREEN}PASS${NC}: ${PASS}건"
echo -e " ${RED}FAIL${NC}: ${FAIL}건"
echo -e " ${YELLOW}SKIP${NC}: ${SKIP}건"
echo "========================================="

if [ "$FAIL" -eq 0 ]; then
    echo -e "${GREEN}ALL TESTS PASSED${NC}"
    exit 0
else
    echo -e "${RED}${FAIL} TESTS FAILED${NC}"
    exit 1
fi
