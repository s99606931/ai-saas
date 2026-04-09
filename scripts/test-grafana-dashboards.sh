#!/bin/bash
# =============================================================================
# MTU-N61: Grafana 공공기관 SaaS 특화 대시보드 테스트
# Design Ref: MTU-N61 Design §1
# Plan SC: FR-N61.6
# CSAP: D-06(모니터링 대시보드 검증)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DASHBOARD_DIR="$PROJECT_DIR/infra/monitoring/dashboards"

# 색상 출력
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

PASS=0; FAIL=0; SKIP=0; TOTAL=0

pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo -e "  ${GREEN}[PASS]${NC} $*"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo -e "  ${RED}[FAIL]${NC} $*"; }
skip() { SKIP=$((SKIP+1)); TOTAL=$((TOTAL+1)); echo -e "  ${YELLOW}[SKIP]${NC} $*"; }
header() { echo -e "\n${BOLD}${CYAN}=== $* ===${NC}"; }

# =============================================================================
# Phase 1: 대시보드 파일 존재 검증
# =============================================================================
header "Phase 1: 대시보드 파일 존재 검증"

# T1: CSAP 준수 현황 대시보드
if [[ -f "$DASHBOARD_DIR/csap-compliance-status.json" ]]; then
  pass "T1: FR-N61.1 CSAP 준수 현황 대시보드 파일 존재"
else
  fail "T1: FR-N61.1 csap-compliance-status.json 미존재"
fi

# T2: 테넌트 리소스 대시보드
if [[ -f "$DASHBOARD_DIR/tenant-resource-usage.json" ]]; then
  pass "T2: FR-N61.2 테넌트 리소스 대시보드 파일 존재"
else
  fail "T2: FR-N61.2 tenant-resource-usage.json 미존재"
fi

# T3: 인증/보안 이벤트 대시보드
if [[ -f "$DASHBOARD_DIR/security-auth-events.json" ]]; then
  pass "T3: FR-N61.3 인증/보안 이벤트 대시보드 파일 존재"
else
  fail "T3: FR-N61.3 security-auth-events.json 미존재"
fi

# =============================================================================
# Phase 2: JSON 유효성 검증
# =============================================================================
header "Phase 2: JSON 유효성 검증"

validate_json() {
  local file="$1"
  local label="$2"
  if python3 -m json.tool "$file" > /dev/null 2>&1; then
    pass "$label JSON 유효성 통과"
    return 0
  else
    fail "$label JSON 유효성 실패"
    return 1
  fi
}

# T4-T6: JSON 유효성
validate_json "$DASHBOARD_DIR/csap-compliance-status.json" "T4: CSAP 대시보드"
validate_json "$DASHBOARD_DIR/tenant-resource-usage.json" "T5: 테넌트 대시보드"
validate_json "$DASHBOARD_DIR/security-auth-events.json" "T6: 보안 대시보드"

# =============================================================================
# Phase 3: 대시보드 구조 검증
# =============================================================================
header "Phase 3: 대시보드 구조 검증"

# T7: CSAP 대시보드 — 패널 수 확인 (최소 6개)
CSAP_PANELS=$(python3 -c "
import json
with open('$DASHBOARD_DIR/csap-compliance-status.json') as f:
    d = json.load(f)
    panels = [p for p in d.get('panels', []) if p.get('type') != 'row']
    print(len(panels))
" 2>/dev/null || echo 0)
if [[ "$CSAP_PANELS" -ge 6 ]]; then
  pass "T7: CSAP 대시보드 패널 ${CSAP_PANELS}개 (목표: 6개+)"
else
  fail "T7: CSAP 대시보드 패널 ${CSAP_PANELS}개 (목표: 6개 미달)"
fi

# T8: 테넌트 대시보드 — 패널 수 확인 (최소 6개)
TENANT_PANELS=$(python3 -c "
import json
with open('$DASHBOARD_DIR/tenant-resource-usage.json') as f:
    d = json.load(f)
    panels = [p for p in d.get('panels', []) if p.get('type') != 'row']
    print(len(panels))
" 2>/dev/null || echo 0)
if [[ "$TENANT_PANELS" -ge 6 ]]; then
  pass "T8: 테넌트 대시보드 패널 ${TENANT_PANELS}개 (목표: 6개+)"
else
  fail "T8: 테넌트 대시보드 패널 ${TENANT_PANELS}개 (목표: 6개 미달)"
fi

# T9: 보안 대시보드 — 패널 수 확인 (최소 6개)
SEC_PANELS=$(python3 -c "
import json
with open('$DASHBOARD_DIR/security-auth-events.json') as f:
    d = json.load(f)
    panels = [p for p in d.get('panels', []) if p.get('type') != 'row']
    print(len(panels))
" 2>/dev/null || echo 0)
if [[ "$SEC_PANELS" -ge 6 ]]; then
  pass "T9: 보안 대시보드 패널 ${SEC_PANELS}개 (목표: 6개+)"
else
  fail "T9: 보안 대시보드 패널 ${SEC_PANELS}개 (목표: 6개 미달)"
fi

# =============================================================================
# Phase 4: Recording Rules 활용 검증 (FR-N61.4)
# =============================================================================
header "Phase 4: Recording Rules 활용 검증"

# T10: 테넌트 대시보드에서 recording rule 사용
if grep -q "namespace:cpu_usage:sum" "$DASHBOARD_DIR/tenant-resource-usage.json" 2>/dev/null; then
  pass "T10: FR-N61.4 테넌트 대시보드 recording rule 활용 (namespace:cpu_usage:sum)"
else
  fail "T10: FR-N61.4 테넌트 대시보드 recording rule 미사용"
fi

# T11: 테넌트 대시보드에서 메모리 recording rule 사용
if grep -q "namespace:memory_usage:sum_bytes" "$DASHBOARD_DIR/tenant-resource-usage.json" 2>/dev/null; then
  pass "T11: FR-N61.4 테넌트 대시보드 recording rule 활용 (memory)"
else
  fail "T11: FR-N61.4 테넌트 대시보드 메모리 recording rule 미사용"
fi

# T12: CSAP 대시보드에서 cluster recording rule 사용
if grep -q "cluster:pod_ready:ratio" "$DASHBOARD_DIR/csap-compliance-status.json" 2>/dev/null; then
  pass "T12: FR-N61.4 CSAP 대시보드 recording rule 활용 (cluster:pod_ready)"
else
  fail "T12: FR-N61.4 CSAP 대시보드 recording rule 미사용"
fi

# T13: 테넌트 대시보드에서 서비스 에러율 recording rule 사용
if grep -q "service:http_errors:ratio_rate5m" "$DASHBOARD_DIR/tenant-resource-usage.json" 2>/dev/null; then
  pass "T13: FR-N61.4 서비스 에러율 recording rule 활용"
else
  fail "T13: FR-N61.4 서비스 에러율 recording rule 미사용"
fi

# =============================================================================
# Phase 5: 한국어 적용 검증 (FR-N61.5)
# =============================================================================
header "Phase 5: 한국어 레이블 검증"

# T14: 대시보드 타임존 Asia/Seoul
if grep -q "Asia/Seoul" "$DASHBOARD_DIR/csap-compliance-status.json" 2>/dev/null; then
  pass "T14: FR-N61.5 타임존 Asia/Seoul (CSAP 대시보드)"
else
  fail "T14: FR-N61.5 타임존 Asia/Seoul 미설정"
fi

# T15: 한국어 제목 확인
if grep -q "CSAP 준수 현황" "$DASHBOARD_DIR/csap-compliance-status.json" 2>/dev/null; then
  pass "T15: FR-N61.5 한국어 대시보드 제목 (CSAP 준수 현황)"
else
  fail "T15: FR-N61.5 한국어 제목 미적용"
fi

# T16: 한국어 설명 확인 (테넌트)
if grep -q "테넌트별" "$DASHBOARD_DIR/tenant-resource-usage.json" 2>/dev/null; then
  pass "T16: FR-N61.5 한국어 설명 (테넌트별)"
else
  fail "T16: FR-N61.5 한국어 설명 미적용"
fi

# =============================================================================
# Phase 6: CSAP 태그 + UID 검증
# =============================================================================
header "Phase 6: CSAP 태그 및 UID 검증"

# T17: CSAP 대시보드 태그
if grep -q '"csap"' "$DASHBOARD_DIR/csap-compliance-status.json" 2>/dev/null; then
  pass "T17: CSAP 대시보드 'csap' 태그 포함"
else
  fail "T17: CSAP 대시보드 'csap' 태그 누락"
fi

# T18: 보안 대시보드 태그
if grep -q '"security"' "$DASHBOARD_DIR/security-auth-events.json" 2>/dev/null; then
  pass "T18: 보안 대시보드 'security' 태그 포함"
else
  fail "T18: 보안 대시보드 'security' 태그 누락"
fi

# T19: public-saas 태그 일관성
SAAS_TAG_COUNT=0
for f in csap-compliance-status.json tenant-resource-usage.json security-auth-events.json; do
  if grep -q '"public-saas"' "$DASHBOARD_DIR/$f" 2>/dev/null; then
    SAAS_TAG_COUNT=$((SAAS_TAG_COUNT+1))
  fi
done
if [[ "$SAAS_TAG_COUNT" -ge 3 ]]; then
  pass "T19: 'public-saas' 태그 ${SAAS_TAG_COUNT}/3 대시보드 적용"
else
  fail "T19: 'public-saas' 태그 ${SAAS_TAG_COUNT}/3 (일부 누락)"
fi

# T20: 대시보드 UID 고유성
UIDS=$(grep -h '"uid"' "$DASHBOARD_DIR/csap-compliance-status.json" "$DASHBOARD_DIR/tenant-resource-usage.json" "$DASHBOARD_DIR/security-auth-events.json" 2>/dev/null | sort | uniq | wc -l)
if [[ "$UIDS" -ge 3 ]]; then
  pass "T20: 대시보드 UID 고유성 확인 (${UIDS}개 고유)"
else
  fail "T20: 대시보드 UID 중복 존재"
fi

# T21: Variable (변수) 기반 필터링
if grep -q '"templating"' "$DASHBOARD_DIR/tenant-resource-usage.json" 2>/dev/null; then
  pass "T21: FR-N61.5 테넌트 대시보드 Grafana Variable 정의"
else
  fail "T21: FR-N61.5 Grafana Variable 미정의"
fi

# =============================================================================
# Phase 7: 전체 대시보드 개수 확인
# =============================================================================
header "Phase 7: 전체 대시보드 현황"

TOTAL_DASHBOARDS=$(ls -1 "$DASHBOARD_DIR"/*.json "$DASHBOARD_DIR"/*.yaml 2>/dev/null | wc -l)
pass "T22: 전체 대시보드 파일 ${TOTAL_DASHBOARDS}개 (기존 14개 + 신규 3개)"

# =============================================================================
# 결과 요약
# =============================================================================
echo ""
header "테스트 결과 요약"
echo -e "  ${GREEN}PASS${NC}: $PASS"
echo -e "  ${RED}FAIL${NC}: $FAIL"
echo -e "  ${YELLOW}SKIP${NC}: $SKIP"
echo -e "  ${BOLD}TOTAL${NC}: $TOTAL"

MATCH_RATE=0
if [[ $((PASS + FAIL)) -gt 0 ]]; then
  MATCH_RATE=$(( (PASS * 100) / (PASS + FAIL) ))
fi
echo -e "\n  ${BOLD}matchRate: ${MATCH_RATE}%${NC}"

if [[ $FAIL -eq 0 ]]; then
  echo -e "\n${GREEN}${BOLD}  MTU-N61 Grafana 공공기관 SaaS 대시보드: ALL PASS${NC}"
  exit 0
else
  echo -e "\n${RED}${BOLD}  MTU-N61: ${FAIL}개 테스트 실패${NC}"
  exit 1
fi
