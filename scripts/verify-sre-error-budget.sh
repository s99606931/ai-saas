#!/usr/bin/env bash
# MTU-N255: SRE 에러 버짓 + 온콜 검증
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
PASS=0; FAIL=0; TOTAL=0
check() { local d="$1" r="$2"; TOTAL=$((TOTAL+1)); if [[ "$r" == "pass" ]]; then echo -e "  ${GREEN}[PASS]${NC} $d"; PASS=$((PASS+1)); else echo -e "  ${RED}[FAIL]${NC} $d"; FAIL=$((FAIL+1)); fi; }

echo -e "${BOLD}=== MTU-N255: SRE 에러 버짓 + 온콜 검증 ===${NC}"
echo ""

echo -e "${BLUE}[SC-1] 에러 버짓 Recording Rules${NC}"
F="$PROJECT_ROOT/infra/monitoring/error-budget-automation-rules.yaml"
[[ -f "$F" ]] && check "파일 존재" "pass" || check "파일 존재" "fail"
grep -q "error_budget:remaining_ratio" "$F" 2>/dev/null && check "잔여량 규칙" "pass" || check "잔여량 규칙" "fail"
grep -q "burn_rate" "$F" 2>/dev/null && check "소진율 규칙" "pass" || check "소진율 규칙" "fail"
grep -q "days_remaining" "$F" 2>/dev/null && check "소진 예측 규칙" "pass" || check "소진 예측 규칙" "fail"
grep -q "remaining_by_service" "$F" 2>/dev/null && check "서비스별 에러 버짓" "pass" || check "서비스별 에러 버짓" "fail"
echo ""

echo -e "${BLUE}[SC-2] 자동 액션 알림${NC}"
grep -q "SREErrorBudgetExhausted" "$F" 2>/dev/null && check "에러 버짓 소진 알림" "pass" || check "소진 알림" "fail"
grep -q "deploy-freeze" "$F" 2>/dev/null && check "배포 동결 액션" "pass" || check "배포 동결 액션" "fail"
grep -q "SREErrorBudgetLow" "$F" 2>/dev/null && check "에러 버짓 경고 알림" "pass" || check "경고 알림" "fail"
grep -q "SREErrorBudgetBurningFast" "$F" 2>/dev/null && check "빠른 소진 알림" "pass" || check "빠른 소진 알림" "fail"
echo ""

echo -e "${BLUE}[SC-3] 온콜 에스컬레이션${NC}"
F2="$PROJECT_ROOT/infra/monitoring/oncall-escalation-rules.yaml"
[[ -f "$F2" ]] && check "파일 존재" "pass" || check "파일 존재" "fail"
grep -q "OncallP1Escalation5min" "$F2" 2>/dev/null && check "P1 5분 에스컬레이션" "pass" || check "P1 5분" "fail"
grep -q "OncallP1Escalation15min" "$F2" 2>/dev/null && check "P1 15분 에스컬레이션" "pass" || check "P1 15분" "fail"
grep -q "OncallP2Escalation30min" "$F2" 2>/dev/null && check "P2 30분 에스컬레이션" "pass" || check "P2 30분" "fail"
grep -q "OncallP3AutoReport" "$F2" 2>/dev/null && check "P3 자동 보고" "pass" || check "P3 보고" "fail"
grep -q "oncall:active:total" "$F2" 2>/dev/null && check "총 활성 인시던트 규칙" "pass" || check "총 활성" "fail"
grep -q "escalation:daily_count" "$F2" 2>/dev/null && check "에스컬레이션 횟수 규칙" "pass" || check "에스컬레이션 횟수" "fail"
echo ""

echo -e "${BLUE}[SC-4] Grafana 대시보드${NC}"
F3="$PROJECT_ROOT/infra/monitoring/dashboards/error-budget-automation.json"
[[ -f "$F3" ]] && check "대시보드 존재" "pass" || check "대시보드 존재" "fail"
python3 -c "import json; json.load(open('$F3'))" 2>/dev/null && check "JSON 유효성" "pass" || check "JSON 유효성" "fail"
grep -q "error_budget:remaining" "$F3" 2>/dev/null && check "에러 버짓 패널" "pass" || check "에러 버짓 패널" "fail"
grep -q "oncall:active" "$F3" 2>/dev/null && check "온콜 현황 패널" "pass" || check "온콜 현황 패널" "fail"
echo ""

echo -e "${BLUE}[CSAP] 참조${NC}"
grep -q "csap" "$PROJECT_ROOT/infra/monitoring/error-budget-automation-rules.yaml" 2>/dev/null && check "CSAP 참조 (에러버짓)" "pass" || check "CSAP" "fail"
grep -q "csap" "$PROJECT_ROOT/infra/monitoring/oncall-escalation-rules.yaml" 2>/dev/null && check "CSAP 참조 (온콜)" "pass" || check "CSAP" "fail"
[[ -f "$PROJECT_ROOT/docs/01-plan/mtus/MTU-N255-sre-error-budget.plan.md" ]] && check "Plan 문서" "pass" || check "Plan" "fail"
[[ -f "$PROJECT_ROOT/docs/02-design/mtus/MTU-N255-sre-error-budget.design.md" ]] && check "Design 문서" "pass" || check "Design" "fail"

echo ""
echo -e "${BOLD}=== 검증 결과 ===${NC}"
echo -e "  통과: ${GREEN}${PASS}${NC} / ${TOTAL}"; echo -e "  실패: ${RED}${FAIL}${NC} / ${TOTAL}"
MR=$(echo "scale=1; ${PASS} * 100 / ${TOTAL}" | bc 2>/dev/null || echo "0")
echo -e "  매치율: ${BOLD}${MR}%${NC}"
if [[ "$FAIL" -eq 0 ]]; then echo -e "${GREEN}${BOLD}MTU-N255: 검증 통과${NC}"; exit 0
elif [[ "$(echo "$MR >= 90" | bc 2>/dev/null)" == "1" ]]; then echo -e "${YELLOW}${BOLD}MTU-N255: 조건부 통과${NC}"; exit 0
else echo -e "${RED}${BOLD}MTU-N255: 검증 실패${NC}"; exit 1; fi
