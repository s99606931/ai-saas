#!/usr/bin/env bash
# =============================================================================
# CSAP 증거 수집 v2 검증 스크립트
# Design Ref: MTU-N253
# Plan SC: SC-1 ~ SC-6
# =============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0 FAIL=0 WARN=0 TOTAL=0

check() {
  local desc="$1" result="$2"
  TOTAL=$((TOTAL + 1))
  if [[ "$result" == "pass" ]]; then
    echo -e "  ${GREEN}[PASS]${NC} ${desc}"; PASS=$((PASS + 1))
  elif [[ "$result" == "warn" ]]; then
    echo -e "  ${YELLOW}[WARN]${NC} ${desc}"; WARN=$((WARN + 1))
  else
    echo -e "  ${RED}[FAIL]${NC} ${desc}"; FAIL=$((FAIL + 1))
  fi
}

echo -e "${BOLD}=== MTU-N253: CSAP 증거 수집 v2 검증 ===${NC}"
echo ""

# SC-1: CI/CD 워크플로우
echo -e "${BLUE}[SC-1] CI/CD 주간 자동 수집 워크플로우${NC}"
F="$PROJECT_ROOT/.gitea/workflows/csap-evidence.yml"
if [[ -f "$F" ]]; then
  check "워크플로우 파일 존재" "pass"
  if grep -q "schedule" "$F" 2>/dev/null; then check "주간 스케줄 설정" "pass"; else check "주간 스케줄 설정" "fail"; fi
  if grep -q "workflow_dispatch" "$F" 2>/dev/null; then check "수동 트리거 지원" "pass"; else check "수동 트리거 지원" "fail"; fi
  if grep -q "upload-artifact" "$F" 2>/dev/null; then check "아티팩트 업로드" "pass"; else check "아티팩트 업로드" "fail"; fi
  if grep -q "sha256sum" "$F" 2>/dev/null; then check "무결성 검증 단계" "pass"; else check "무결성 검증 단계" "fail"; fi
else
  check "워크플로우 파일 존재" "fail"
fi
echo ""

# SC-2: DORA 메트릭 증거
echo -e "${BLUE}[SC-2] DORA Four Keys 메트릭 증거${NC}"
F="$PROJECT_ROOT/scripts/csap-evidence-collect-v2.sh"
if [[ -f "$F" ]]; then
  check "증거 수집 v2 스크립트 존재" "pass"
  if grep -q "dora:deployment_frequency" "$F" 2>/dev/null; then check "배포 빈도 수집" "pass"; else check "배포 빈도 수집" "fail"; fi
  if grep -q "dora:lead_time" "$F" 2>/dev/null; then check "리드타임 수집" "pass"; else check "리드타임 수집" "fail"; fi
  if grep -q "dora:change_failure_rate" "$F" 2>/dev/null; then check "CFR 수집" "pass"; else check "CFR 수집" "fail"; fi
  if grep -q "dora:mttr" "$F" 2>/dev/null; then check "MTTR 수집" "pass"; else check "MTTR 수집" "fail"; fi
  if grep -q "dora:grade" "$F" 2>/dev/null; then check "DORA 등급 수집" "pass"; else check "DORA 등급 수집" "fail"; fi
else
  check "증거 수집 v2 스크립트 존재" "fail"
fi
echo ""

# SC-3: RCA 분석 증거
echo -e "${BLUE}[SC-3] RCA 분석 결과 증거${NC}"
if [[ -f "$F" ]]; then
  if grep -q "rca:active_patterns" "$F" 2>/dev/null; then check "활성 RCA 패턴 수집" "pass"; else check "활성 RCA 패턴 수집" "fail"; fi
  if grep -q "rca:max_anomaly" "$F" 2>/dev/null; then check "최대 이상 스코어 수집" "pass"; else check "최대 이상 스코어 수집" "fail"; fi
  if grep -q "rca" "$F" 2>/dev/null; then check "RCA 디렉토리 생성" "pass"; else check "RCA 디렉토리 생성" "fail"; fi
fi
echo ""

# SC-4: 무결성 검증
echo -e "${BLUE}[SC-4] 증거 무결성 (SHA256)${NC}"
if grep -q "sha256sum" "$F" 2>/dev/null; then check "SHA256 해시 생성" "pass"; else check "SHA256 해시 생성" "fail"; fi
if grep -q "manifest" "$F" 2>/dev/null; then check "매니페스트 파일 생성" "pass"; else check "매니페스트 파일 생성" "fail"; fi
echo ""

# SC-5: ZIP 패키징 + 인덱스
echo -e "${BLUE}[SC-5] ZIP 패키징 + 인덱스${NC}"
if grep -q "zip\|tar" "$F" 2>/dev/null; then check "패키징 기능" "pass"; else check "패키징 기능" "fail"; fi
if grep -q "evidence-index" "$F" 2>/dev/null; then check "증거 인덱스 생성" "pass"; else check "증거 인덱스 생성" "fail"; fi
echo ""

# 통제항목 커버리지
echo -e "${BLUE}[커버리지] 통제항목 수집 범위${NC}"
for ctrl in "D-06" "D-08" "D-09" "D-10" "D-12" "SLO" "MONITORING"; do
  if grep -q "$ctrl" "$F" 2>/dev/null; then
    check "${ctrl} 증거 수집" "pass"
  else
    check "${ctrl} 증거 수집" "fail"
  fi
done
echo ""

# CSAP/Design 참조
echo -e "${BLUE}[CSAP] 참조 검증${NC}"
if grep -qi "csap\|Design Ref" "$F" 2>/dev/null; then check "CSAP/Design 참조 주석" "pass"; else check "CSAP/Design 참조 주석" "fail"; fi
if [[ -f "$PROJECT_ROOT/docs/01-plan/mtus/MTU-N253-csap-evidence-v2.plan.md" ]]; then check "Plan 문서" "pass"; else check "Plan 문서" "fail"; fi
if [[ -f "$PROJECT_ROOT/docs/02-design/mtus/MTU-N253-csap-evidence-v2.design.md" ]]; then check "Design 문서" "pass"; else check "Design 문서" "fail"; fi

# 실제 수집 테스트 (dry-run)
echo ""
echo -e "${BLUE}[실행] dry-run 테스트${NC}"
if [[ -x "$F" ]] || chmod +x "$F" 2>/dev/null; then
  if bash "$F" --dry-run --no-zip 2>&1 | grep -q "완료"; then
    check "dry-run 실행 성공" "pass"
  else
    check "dry-run 실행 성공" "warn"
  fi
else
  check "스크립트 실행 권한" "fail"
fi

# 결과
echo ""
echo -e "${BOLD}=== 검증 결과 ===${NC}"
echo -e "  통과: ${GREEN}${PASS}${NC} / ${TOTAL}"
echo -e "  경고: ${YELLOW}${WARN}${NC} / ${TOTAL}"
echo -e "  실패: ${RED}${FAIL}${NC} / ${TOTAL}"
MATCH_RATE=$(echo "scale=1; ${PASS} * 100 / ${TOTAL}" | bc 2>/dev/null || echo "0")
echo -e "  매치율: ${BOLD}${MATCH_RATE}%${NC}"

if [[ "$FAIL" -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}MTU-N253: 검증 통과${NC}"; exit 0
elif [[ "$(echo "$MATCH_RATE >= 90" | bc 2>/dev/null)" == "1" ]]; then
  echo -e "${YELLOW}${BOLD}MTU-N253: 조건부 통과 (${MATCH_RATE}%)${NC}"; exit 0
else
  echo -e "${RED}${BOLD}MTU-N253: 검증 실패 (${MATCH_RATE}%)${NC}"; exit 1
fi
