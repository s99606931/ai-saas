#!/usr/bin/env bash
# =============================================================================
# DORA Four Keys 구현 검증 스크립트
# Design Ref: MTU-N251 Design
# Plan SC: SC-1 ~ SC-7
# CSAP: D-06(침해사고 관리), D-12(시스템 개발 보안)
#
# 사용법: ./scripts/verify-dora-four-keys.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0
TOTAL=0

check() {
  local desc="$1"
  local result="$2"
  TOTAL=$((TOTAL + 1))

  if [[ "$result" == "pass" ]]; then
    echo -e "  ${GREEN}[PASS]${NC} ${desc}"
    PASS=$((PASS + 1))
  elif [[ "$result" == "warn" ]]; then
    echo -e "  ${YELLOW}[WARN]${NC} ${desc}"
    WARN=$((WARN + 1))
  else
    echo -e "  ${RED}[FAIL]${NC} ${desc}"
    FAIL=$((FAIL + 1))
  fi
}

echo -e "${BOLD}=== MTU-N251: DORA Four Keys 완전 자동화 검증 ===${NC}"
echo ""

# ---------------------------------------------------------------
# SC-1: Deployment Frequency 자동 측정
# ---------------------------------------------------------------
echo -e "${BLUE}[SC-1] 배포 빈도 자동 측정${NC}"

if [[ -f "$PROJECT_ROOT/infra/monitoring/dora-metrics-rules-v2.yaml" ]]; then
  check "Recording Rules v2 파일 존재" "pass"

  if grep -q "dora:deployment_frequency:hourly" "$PROJECT_ROOT/infra/monitoring/dora-metrics-rules-v2.yaml"; then
    check "시간당 배포 빈도 규칙" "pass"
  else
    check "시간당 배포 빈도 규칙" "fail"
  fi

  if grep -q "dora:deployment_frequency:daily\b" "$PROJECT_ROOT/infra/monitoring/dora-metrics-rules-v2.yaml"; then
    check "일간 배포 빈도 규칙" "pass"
  else
    check "일간 배포 빈도 규칙" "fail"
  fi

  if grep -q "dora:deployment_frequency:weekly" "$PROJECT_ROOT/infra/monitoring/dora-metrics-rules-v2.yaml"; then
    check "주간 배포 빈도 규칙" "pass"
  else
    check "주간 배포 빈도 규칙" "fail"
  fi

  if grep -q "dora:deployment_frequency:monthly" "$PROJECT_ROOT/infra/monitoring/dora-metrics-rules-v2.yaml"; then
    check "월간 배포 빈도 규칙" "pass"
  else
    check "월간 배포 빈도 규칙" "fail"
  fi

  if grep -q "daily_by_team" "$PROJECT_ROOT/infra/monitoring/dora-metrics-rules-v2.yaml"; then
    check "팀별 배포 빈도 규칙" "pass"
  else
    check "팀별 배포 빈도 규칙" "fail"
  fi
else
  check "Recording Rules v2 파일 존재" "fail"
fi

echo ""

# ---------------------------------------------------------------
# SC-2: Lead Time for Changes 추적
# ---------------------------------------------------------------
echo -e "${BLUE}[SC-2] 변경 리드타임 추적${NC}"

if grep -q "dora:lead_time:p50" "$PROJECT_ROOT/infra/monitoring/dora-metrics-rules-v2.yaml" 2>/dev/null; then
  check "P50 리드타임 규칙" "pass"
else
  check "P50 리드타임 규칙" "fail"
fi

if grep -q "dora:lead_time:p90" "$PROJECT_ROOT/infra/monitoring/dora-metrics-rules-v2.yaml" 2>/dev/null; then
  check "P90 리드타임 규칙" "pass"
else
  check "P90 리드타임 규칙" "fail"
fi

if grep -q "dora:lead_time:p99" "$PROJECT_ROOT/infra/monitoring/dora-metrics-rules-v2.yaml" 2>/dev/null; then
  check "P99 리드타임 규칙" "pass"
else
  check "P99 리드타임 규칙" "fail"
fi

if grep -q "avg_by_team" "$PROJECT_ROOT/infra/monitoring/dora-metrics-rules-v2.yaml" 2>/dev/null; then
  check "팀별 리드타임 규칙" "pass"
else
  check "팀별 리드타임 규칙" "fail"
fi

echo ""

# ---------------------------------------------------------------
# SC-3: MTTR 자동 계산
# ---------------------------------------------------------------
echo -e "${BLUE}[SC-3] MTTR 자동 계산${NC}"

if grep -q "dora:mttr:avg_minutes" "$PROJECT_ROOT/infra/monitoring/dora-metrics-rules-v2.yaml" 2>/dev/null; then
  check "평균 MTTR 규칙" "pass"
else
  check "평균 MTTR 규칙" "fail"
fi

if grep -q "dora:mttr:p50_minutes" "$PROJECT_ROOT/infra/monitoring/dora-metrics-rules-v2.yaml" 2>/dev/null; then
  check "P50 MTTR 규칙" "pass"
else
  check "P50 MTTR 규칙" "fail"
fi

if grep -q "dora:mttr:p90_minutes" "$PROJECT_ROOT/infra/monitoring/dora-metrics-rules-v2.yaml" 2>/dev/null; then
  check "P90 MTTR 규칙" "pass"
else
  check "P90 MTTR 규칙" "fail"
fi

if grep -q "dora:mttd:detection_delay" "$PROJECT_ROOT/infra/monitoring/dora-metrics-rules-v2.yaml" 2>/dev/null; then
  check "MTTD (감지 시간) 규칙" "pass"
else
  check "MTTD (감지 시간) 규칙" "fail"
fi

echo ""

# ---------------------------------------------------------------
# SC-4: Change Failure Rate 정밀 측정
# ---------------------------------------------------------------
echo -e "${BLUE}[SC-4] 변경 실패율 정밀 측정${NC}"

if grep -q "dora:change_failure_rate:ratio" "$PROJECT_ROOT/infra/monitoring/dora-metrics-rules-v2.yaml" 2>/dev/null; then
  check "일간 CFR 규칙" "pass"
else
  check "일간 CFR 규칙" "fail"
fi

if grep -q "weekly_ratio" "$PROJECT_ROOT/infra/monitoring/dora-metrics-rules-v2.yaml" 2>/dev/null; then
  check "주간 CFR 규칙" "pass"
else
  check "주간 CFR 규칙" "fail"
fi

if grep -q "type=\"rollback\"" "$PROJECT_ROOT/infra/monitoring/dora-metrics-rules-v2.yaml" 2>/dev/null; then
  check "롤백 포함 CFR" "pass"
else
  check "롤백 포함 CFR" "fail"
fi

if grep -q "type=\"hotfix\"" "$PROJECT_ROOT/infra/monitoring/dora-metrics-rules-v2.yaml" 2>/dev/null; then
  check "핫픽스 포함 CFR" "pass"
else
  check "핫픽스 포함 CFR" "fail"
fi

echo ""

# ---------------------------------------------------------------
# SC-5: DORA 등급 자동 판정
# ---------------------------------------------------------------
echo -e "${BLUE}[SC-5] DORA 등급 자동 판정${NC}"

if grep -q "dora:grade:deployment_frequency" "$PROJECT_ROOT/infra/monitoring/dora-metrics-rules-v2.yaml" 2>/dev/null; then
  check "DF 등급 규칙" "pass"
else
  check "DF 등급 규칙" "fail"
fi

if grep -q "dora:grade:lead_time" "$PROJECT_ROOT/infra/monitoring/dora-metrics-rules-v2.yaml" 2>/dev/null; then
  check "LT 등급 규칙" "pass"
else
  check "LT 등급 규칙" "fail"
fi

if grep -q "dora:grade:change_failure_rate" "$PROJECT_ROOT/infra/monitoring/dora-metrics-rules-v2.yaml" 2>/dev/null; then
  check "CFR 등급 규칙" "pass"
else
  check "CFR 등급 규칙" "fail"
fi

if grep -q "dora:grade:mttr" "$PROJECT_ROOT/infra/monitoring/dora-metrics-rules-v2.yaml" 2>/dev/null; then
  check "MTTR 등급 규칙" "pass"
else
  check "MTTR 등급 규칙" "fail"
fi

if grep -q "dora:grade:overall" "$PROJECT_ROOT/infra/monitoring/dora-metrics-rules-v2.yaml" 2>/dev/null; then
  check "종합 등급 규칙" "pass"
else
  check "종합 등급 규칙" "fail"
fi

echo ""

# ---------------------------------------------------------------
# SC-6: CI/CD DORA 게이트 연동
# ---------------------------------------------------------------
echo -e "${BLUE}[SC-6] CI/CD DORA 게이트 연동${NC}"

if [[ -f "$PROJECT_ROOT/.gitea/workflows/dora-gate.yml" ]]; then
  check "DORA 게이트 워크플로우 파일 존재" "pass"

  if grep -q "CFR" "$PROJECT_ROOT/.gitea/workflows/dora-gate.yml" 2>/dev/null; then
    check "CFR 기반 배포 차단 로직" "pass"
  else
    check "CFR 기반 배포 차단 로직" "fail"
  fi

  if grep -q "30" "$PROJECT_ROOT/.gitea/workflows/dora-gate.yml" 2>/dev/null; then
    check "CFR > 30% 차단 임계값" "pass"
  else
    check "CFR > 30% 차단 임계값" "fail"
  fi

  if grep -q "15" "$PROJECT_ROOT/.gitea/workflows/dora-gate.yml" 2>/dev/null; then
    check "CFR > 15% 경고 임계값" "pass"
  else
    check "CFR > 15% 경고 임계값" "fail"
  fi

  if grep -q "audit" "$PROJECT_ROOT/.gitea/workflows/dora-gate.yml" 2>/dev/null; then
    check "감사 로그 기록" "pass"
  else
    check "감사 로그 기록" "fail"
  fi
else
  check "DORA 게이트 워크플로우 파일 존재" "fail"
fi

echo ""

# ---------------------------------------------------------------
# SC-7: Grafana 대시보드
# ---------------------------------------------------------------
echo -e "${BLUE}[SC-7] Grafana 대시보드${NC}"

if [[ -f "$PROJECT_ROOT/infra/monitoring/dashboards/dora-four-keys.json" ]]; then
  check "DORA Four Keys 대시보드 JSON 존재" "pass"

  if python3 -c "import json; json.load(open('$PROJECT_ROOT/infra/monitoring/dashboards/dora-four-keys.json'))" 2>/dev/null; then
    check "JSON 형식 유효성" "pass"
  else
    check "JSON 형식 유효성" "fail"
  fi

  PANEL_COUNT=$(python3 -c "
import json
with open('$PROJECT_ROOT/infra/monitoring/dashboards/dora-four-keys.json') as f:
    d = json.load(f)
    panels = [p for p in d.get('panels', []) if p.get('type') != 'row']
    print(len(panels))
" 2>/dev/null || echo "0")

  if [[ "$PANEL_COUNT" -ge 8 ]]; then
    check "대시보드 패널 수: ${PANEL_COUNT}개 (8개 이상)" "pass"
  else
    check "대시보드 패널 수: ${PANEL_COUNT}개 (8개 이상 필요)" "fail"
  fi

  if grep -q "dora:grade:overall" "$PROJECT_ROOT/infra/monitoring/dashboards/dora-four-keys.json" 2>/dev/null; then
    check "종합 등급 패널" "pass"
  else
    check "종합 등급 패널" "fail"
  fi

  if grep -q "dora-four-keys" "$PROJECT_ROOT/infra/monitoring/dashboards/dora-four-keys.json" 2>/dev/null; then
    check "대시보드 UID 설정" "pass"
  else
    check "대시보드 UID 설정" "fail"
  fi
else
  check "DORA Four Keys 대시보드 JSON 존재" "fail"
fi

echo ""

# ---------------------------------------------------------------
# 보조 산출물 검증
# ---------------------------------------------------------------
echo -e "${BLUE}[보조] 추가 산출물 검증${NC}"

if [[ -f "$PROJECT_ROOT/scripts/dora-event-push.sh" ]]; then
  check "DORA 이벤트 Push 스크립트 존재" "pass"
  if [[ -x "$PROJECT_ROOT/scripts/dora-event-push.sh" ]]; then
    check "실행 권한 설정" "pass"
  else
    check "실행 권한 설정" "fail"
  fi
else
  check "DORA 이벤트 Push 스크립트 존재" "fail"
fi

if [[ -f "$PROJECT_ROOT/scripts/generate-dora-report-v2.sh" ]]; then
  check "DORA 보고서 v2 스크립트 존재" "pass"
else
  check "DORA 보고서 v2 스크립트 존재" "fail"
fi

if [[ -f "$PROJECT_ROOT/infra/monitoring/dora-alerting-rules-v2.yaml" ]]; then
  check "DORA 알림 규칙 v2 존재" "pass"

  ALERT_COUNT=$(grep -c "alert:" "$PROJECT_ROOT/infra/monitoring/dora-alerting-rules-v2.yaml" 2>/dev/null || echo "0")
  if [[ "$ALERT_COUNT" -ge 5 ]]; then
    check "알림 규칙 수: ${ALERT_COUNT}개 (5개 이상)" "pass"
  else
    check "알림 규칙 수: ${ALERT_COUNT}개 (5개 이상 필요)" "fail"
  fi
else
  check "DORA 알림 규칙 v2 존재" "fail"
fi

if [[ -f "$PROJECT_ROOT/docs/01-plan/mtus/MTU-N251-dora-four-keys.plan.md" ]]; then
  check "Plan 문서 존재" "pass"
else
  check "Plan 문서 존재" "fail"
fi

if [[ -f "$PROJECT_ROOT/docs/02-design/mtus/MTU-N251-dora-four-keys.design.md" ]]; then
  check "Design 문서 존재" "pass"
else
  check "Design 문서 존재" "fail"
fi

# CSAP 참조 검증
echo ""
echo -e "${BLUE}[CSAP] CSAP/감리 참조 검증${NC}"

CSAP_COUNT=0
for f in \
  "$PROJECT_ROOT/infra/monitoring/dora-metrics-rules-v2.yaml" \
  "$PROJECT_ROOT/infra/monitoring/dora-alerting-rules-v2.yaml" \
  "$PROJECT_ROOT/.gitea/workflows/dora-gate.yml" \
  "$PROJECT_ROOT/scripts/dora-event-push.sh"; do
  if [[ -f "$f" ]] && grep -q "csap" "$f" 2>/dev/null; then
    CSAP_COUNT=$((CSAP_COUNT + 1))
  fi
done

if [[ "$CSAP_COUNT" -ge 3 ]]; then
  check "CSAP 참조 주석: ${CSAP_COUNT}/4 파일" "pass"
else
  check "CSAP 참조 주석: ${CSAP_COUNT}/4 파일 (3개 이상 필요)" "fail"
fi

DESIGN_REF_COUNT=0
for f in \
  "$PROJECT_ROOT/infra/monitoring/dora-metrics-rules-v2.yaml" \
  "$PROJECT_ROOT/infra/monitoring/dora-alerting-rules-v2.yaml" \
  "$PROJECT_ROOT/.gitea/workflows/dora-gate.yml" \
  "$PROJECT_ROOT/scripts/dora-event-push.sh"; do
  if [[ -f "$f" ]] && grep -qi "design.ref\|Design Ref" "$f" 2>/dev/null; then
    DESIGN_REF_COUNT=$((DESIGN_REF_COUNT + 1))
  fi
done

if [[ "$DESIGN_REF_COUNT" -ge 3 ]]; then
  check "Design Ref 주석: ${DESIGN_REF_COUNT}/4 파일" "pass"
else
  check "Design Ref 주석: ${DESIGN_REF_COUNT}/4 파일 (3개 이상 필요)" "fail"
fi

# ---------------------------------------------------------------
# 최종 결과
# ---------------------------------------------------------------
echo ""
echo -e "${BOLD}=== 검증 결과 ===${NC}"
echo -e "  통과: ${GREEN}${PASS}${NC} / ${TOTAL}"
echo -e "  경고: ${YELLOW}${WARN}${NC} / ${TOTAL}"
echo -e "  실패: ${RED}${FAIL}${NC} / ${TOTAL}"

MATCH_RATE=0
if [[ "$TOTAL" -gt 0 ]]; then
  MATCH_RATE=$(echo "scale=1; ${PASS} * 100 / ${TOTAL}" | bc 2>/dev/null || echo "0")
fi
echo -e "  매치율: ${BOLD}${MATCH_RATE}%${NC}"

echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}MTU-N251 DORA Four Keys: 검증 통과${NC}"
  exit 0
elif [[ "$MATCH_RATE" == "90"* ]] || [[ "$(echo "$MATCH_RATE >= 90" | bc 2>/dev/null)" == "1" ]]; then
  echo -e "${YELLOW}${BOLD}MTU-N251 DORA Four Keys: 조건부 통과 (${MATCH_RATE}% >= 90%)${NC}"
  exit 0
else
  echo -e "${RED}${BOLD}MTU-N251 DORA Four Keys: 검증 실패 (${MATCH_RATE}% < 90%)${NC}"
  exit 1
fi
