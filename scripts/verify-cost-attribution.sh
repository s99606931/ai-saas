#!/usr/bin/env bash
# Design Ref: MTU-N160 Section 3
# Plan SC: FR-N160.7
# CSAP: D-06 비용 추적 검증
#
# 비용 귀속 시스템 검증 스크립트

set -euo pipefail

PASS=0
FAIL=0
WARN=0

print_header() {
  echo ""
  echo "========================================"
  echo " 비용 귀속 시스템 검증"
  echo " 검증 시각: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "========================================"
  echo ""
}

check_pass() { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
check_fail() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }
check_warn() { echo "  [WARN] $1"; WARN=$((WARN + 1)); }

# 1. 비용 설정 ConfigMap 검증
check_cost_config() {
  echo "--- 1. 비용 설정 ConfigMap 검증 ---"
  if kubectl get configmap cost-attribution-config -n monitoring &>/dev/null; then
    check_pass "비용 설정 ConfigMap 존재"

    local pricing
    pricing=$(kubectl get configmap cost-attribution-config -n monitoring -o jsonpath='{.data.cost-config\.yaml}' 2>/dev/null || echo "")
    if echo "${pricing}" | grep -q "pricing:" ; then
      check_pass "비용 단가 설정 포함"
    else
      check_fail "비용 단가 설정 누락"
    fi
  else
    check_fail "비용 설정 ConfigMap 없음"
  fi
}

# 2. Prometheus 레코딩 규칙 검증
check_prometheus_rules() {
  echo ""
  echo "--- 2. Prometheus 레코딩 규칙 검증 ---"

  if kubectl api-resources | grep -q "prometheusrules"; then
    if kubectl get prometheusrule cost-attribution-rules -n monitoring &>/dev/null; then
      check_pass "비용 레코딩 규칙 PrometheusRule 존재"
    else
      check_warn "비용 레코딩 규칙 PrometheusRule 미적용"
    fi
  else
    check_warn "PrometheusRule CRD가 설치되어 있지 않습니다"
  fi

  # 규칙 파일 존재 확인
  if [[ -f "/data/ai-saas/infra/cost-attribution/prometheus-rules.yaml" ]]; then
    check_pass "prometheus-rules.yaml 파일 존재"

    local rule_count
    rule_count=$(grep -c "record:" /data/ai-saas/infra/cost-attribution/prometheus-rules.yaml 2>/dev/null || echo "0")
    if [[ ${rule_count} -ge 8 ]]; then
      check_pass "레코딩 규칙 ${rule_count}개 정의"
    else
      check_warn "레코딩 규칙 부족 (${rule_count}개, 최소 8개 권장)"
    fi
  else
    check_fail "prometheus-rules.yaml 파일 없음"
  fi
}

# 3. Grafana 대시보드 검증
check_grafana_dashboard() {
  echo ""
  echo "--- 3. Grafana 대시보드 검증 ---"

  if [[ -f "/data/ai-saas/infra/cost-attribution/grafana-dashboard.json" ]]; then
    check_pass "Grafana 대시보드 JSON 파일 존재"

    local panel_count
    panel_count=$(python3 -c "import json; d=json.load(open('/data/ai-saas/infra/cost-attribution/grafana-dashboard.json')); print(len([p for p in d.get('panels',[]) if p.get('type')!='row']))" 2>/dev/null || echo "0")
    if [[ ${panel_count} -ge 5 ]]; then
      check_pass "대시보드 패널 ${panel_count}개 정의"
    else
      check_warn "대시보드 패널 부족 (${panel_count}개)"
    fi
  else
    check_fail "Grafana 대시보드 파일 없음"
  fi
}

# 4. 보고서 스크립트 검증
check_report_script() {
  echo ""
  echo "--- 4. 비용 정산 보고서 스크립트 검증 ---"

  if [[ -f "/data/ai-saas/scripts/cost-attribution-report.sh" ]]; then
    check_pass "정산 보고서 스크립트 존재"

    if [[ -x "/data/ai-saas/scripts/cost-attribution-report.sh" ]]; then
      check_pass "정산 보고서 스크립트 실행 권한"
    else
      check_fail "정산 보고서 스크립트 실행 권한 없음"
    fi
  else
    check_fail "정산 보고서 스크립트 없음"
  fi
}

print_summary() {
  echo ""
  echo "========================================"
  echo " 검증 결과 요약"
  echo "========================================"
  echo "  PASS: ${PASS}"
  echo "  FAIL: ${FAIL}"
  echo "  WARN: ${WARN}"
  echo ""
  if [[ ${FAIL} -eq 0 ]]; then
    echo "  상태: 정상"
  else
    echo "  상태: ${FAIL}개 항목 실패"
  fi
  echo "========================================"
}

main() {
  print_header
  check_cost_config
  check_prometheus_rules
  check_grafana_dashboard
  check_report_script
  print_summary
  [[ ${FAIL} -gt 0 ]] && exit 1 || exit 0
}

main "$@"
