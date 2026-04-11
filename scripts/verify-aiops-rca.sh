#!/usr/bin/env bash
# =============================================================================
# AIOps RCA 구현 검증 스크립트
# Design Ref: MTU-N252 Design
# Plan SC: SC-1 ~ SC-6
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

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

echo -e "${BOLD}=== MTU-N252: AIOps RCA 자동 근본 원인 분석 검증 ===${NC}"
echo ""

# SC-1: 상관관계 Recording Rules
echo -e "${BLUE}[SC-1] 상관관계 Recording Rules${NC}"
F="$PROJECT_ROOT/infra/monitoring/rca-correlation-rules.yaml"
if [[ -f "$F" ]]; then
  check "상관관계 규칙 파일 존재" "pass"
  for metric in "rca:anomaly_score:cpu" "rca:anomaly_score:memory" "rca:anomaly_score:error_rate" "rca:anomaly_score:latency" "rca:anomaly_score:network" "rca:anomaly_score:disk_io"; do
    if grep -q "$metric" "$F" 2>/dev/null; then
      check "${metric} 규칙" "pass"
    else
      check "${metric} 규칙" "fail"
    fi
  done
  for corr in "cpu_latency" "memory_oom" "error_deployment" "diskio_latency" "network_latency"; do
    if grep -q "rca:correlation:${corr}" "$F" 2>/dev/null; then
      check "상관관계: ${corr}" "pass"
    else
      check "상관관계: ${corr}" "fail"
    fi
  done
else
  check "상관관계 규칙 파일 존재" "fail"
fi
echo ""

# SC-2: RCA 패턴 매핑 (10개+)
echo -e "${BLUE}[SC-2] RCA 패턴 매핑 규칙${NC}"
F="$PROJECT_ROOT/infra/monitoring/rca-pattern-rules.yaml"
if [[ -f "$F" ]]; then
  check "RCA 패턴 규칙 파일 존재" "pass"
  ALERT_COUNT=$(grep -c "alert: RCA" "$F" 2>/dev/null || echo "0")
  if [[ "$ALERT_COUNT" -ge 10 ]]; then
    check "RCA 패턴 수: ${ALERT_COUNT}개 (10개 이상)" "pass"
  else
    check "RCA 패턴 수: ${ALERT_COUNT}개 (10개 이상 필요)" "fail"
  fi
  for pattern in "RCACpuBottleneck" "RCAMemoryLeak" "RCAUpstreamFailure" "RCADiskBottleneck" "RCANetworkIssue" "RCAAppBug" "RCANodeFailure" "RCAStorageExhausted" "RCARecentDeploymentIssue" "RCADnsBottleneck"; do
    if grep -q "$pattern" "$F" 2>/dev/null; then
      check "패턴: ${pattern}" "pass"
    else
      check "패턴: ${pattern}" "fail"
    fi
  done
  if grep -q "rca_cause" "$F" 2>/dev/null; then
    check "RCA 원인 레이블 (rca_cause)" "pass"
  else
    check "RCA 원인 레이블 (rca_cause)" "fail"
  fi
  if grep -q "rca_action" "$F" 2>/dev/null; then
    check "RCA 조치 레이블 (rca_action)" "pass"
  else
    check "RCA 조치 레이블 (rca_action)" "fail"
  fi
else
  check "RCA 패턴 규칙 파일 존재" "fail"
fi
echo ""

# SC-3: Grafana RCA 대시보드
echo -e "${BLUE}[SC-3] Grafana RCA 대시보드${NC}"
F="$PROJECT_ROOT/infra/monitoring/dashboards/rca-analysis.json"
if [[ -f "$F" ]]; then
  check "RCA 대시보드 JSON 존재" "pass"
  if python3 -c "import json; json.load(open('$F'))" 2>/dev/null; then
    check "JSON 유효성" "pass"
  else
    check "JSON 유효성" "fail"
  fi
  PANEL_COUNT=$(python3 -c "import json; d=json.load(open('$F')); print(len([p for p in d.get('panels',[]) if p.get('type')!='row']))" 2>/dev/null || echo "0")
  if [[ "$PANEL_COUNT" -ge 6 ]]; then
    check "패널 수: ${PANEL_COUNT}개 (6개 이상)" "pass"
  else
    check "패널 수: ${PANEL_COUNT}개 (6개 이상 필요)" "fail"
  fi
  if grep -q "rca-analysis" "$F" 2>/dev/null; then
    check "대시보드 UID 설정" "pass"
  else
    check "대시보드 UID 설정" "fail"
  fi
else
  check "RCA 대시보드 JSON 존재" "fail"
fi
echo ""

# SC-4: RCA 보고서 생성
echo -e "${BLUE}[SC-4] RCA 보고서 자동 생성${NC}"
if [[ -f "$PROJECT_ROOT/scripts/generate-rca-report.sh" ]]; then
  check "RCA 보고서 스크립트 존재" "pass"
  if [[ -x "$PROJECT_ROOT/scripts/generate-rca-report.sh" ]]; then
    check "실행 권한 설정" "pass"
  else
    check "실행 권한 설정" "fail"
  fi
else
  check "RCA 보고서 스크립트 존재" "fail"
fi
echo ""

# SC-5: 알림 RCA 주석
echo -e "${BLUE}[SC-5] 알림 RCA 주석${NC}"
F="$PROJECT_ROOT/infra/monitoring/rca-pattern-rules.yaml"
if grep -q "runbook_url" "$F" 2>/dev/null; then
  check "런북 URL 포함" "pass"
else
  check "런북 URL 포함" "fail"
fi
if grep -q "추론 원인" "$F" 2>/dev/null; then
  check "추론 원인 설명 포함" "pass"
else
  check "추론 원인 설명 포함" "fail"
fi
if grep -q "권고 조치" "$F" 2>/dev/null; then
  check "권고 조치 설명 포함" "pass"
else
  check "권고 조치 설명 포함" "fail"
fi
echo ""

# CSAP 검증
echo -e "${BLUE}[CSAP] CSAP 참조 검증${NC}"
CSAP_COUNT=0
for f in "$PROJECT_ROOT/infra/monitoring/rca-correlation-rules.yaml" "$PROJECT_ROOT/infra/monitoring/rca-pattern-rules.yaml"; do
  if [[ -f "$f" ]] && grep -q "csap" "$f" 2>/dev/null; then CSAP_COUNT=$((CSAP_COUNT + 1)); fi
done
if [[ "$CSAP_COUNT" -ge 2 ]]; then
  check "CSAP 참조: ${CSAP_COUNT}/2 파일" "pass"
else
  check "CSAP 참조: ${CSAP_COUNT}/2 파일" "fail"
fi

DESIGN_COUNT=0
for f in "$PROJECT_ROOT/infra/monitoring/rca-correlation-rules.yaml" "$PROJECT_ROOT/infra/monitoring/rca-pattern-rules.yaml"; do
  if [[ -f "$f" ]] && grep -qi "design.ref\|Design Ref" "$f" 2>/dev/null; then DESIGN_COUNT=$((DESIGN_COUNT + 1)); fi
done
if [[ "$DESIGN_COUNT" -ge 2 ]]; then
  check "Design Ref 주석: ${DESIGN_COUNT}/2 파일" "pass"
else
  check "Design Ref 주석: ${DESIGN_COUNT}/2 파일" "fail"
fi

# Plan/Design 문서 확인
if [[ -f "$PROJECT_ROOT/docs/01-plan/mtus/MTU-N252-aiops-rca.plan.md" ]]; then
  check "Plan 문서 존재" "pass"
else
  check "Plan 문서 존재" "fail"
fi
if [[ -f "$PROJECT_ROOT/docs/02-design/mtus/MTU-N252-aiops-rca.design.md" ]]; then
  check "Design 문서 존재" "pass"
else
  check "Design 문서 존재" "fail"
fi

# 결과
echo ""
echo -e "${BOLD}=== 검증 결과 ===${NC}"
echo -e "  통과: ${GREEN}${PASS}${NC} / ${TOTAL}"
echo -e "  경고: ${YELLOW}${WARN}${NC} / ${TOTAL}"
echo -e "  실패: ${RED}${FAIL}${NC} / ${TOTAL}"
MATCH_RATE=$(echo "scale=1; ${PASS} * 100 / ${TOTAL}" | bc 2>/dev/null || echo "0")
echo -e "  매치율: ${BOLD}${MATCH_RATE}%${NC}"

echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}MTU-N252 AIOps RCA: 검증 통과${NC}"
  exit 0
elif [[ "$(echo "$MATCH_RATE >= 90" | bc 2>/dev/null)" == "1" ]]; then
  echo -e "${YELLOW}${BOLD}MTU-N252 AIOps RCA: 조건부 통과 (${MATCH_RATE}% >= 90%)${NC}"
  exit 0
else
  echo -e "${RED}${BOLD}MTU-N252 AIOps RCA: 검증 실패 (${MATCH_RATE}% < 90%)${NC}"
  exit 1
fi
