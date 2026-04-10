#!/usr/bin/env bash
# Design Ref: MTU-N161
# Plan SC: FR-N161.7
# CSAP: D-06 용량 변경 검증
#
# 자동 용량 권고 시스템 검증 스크립트

set -euo pipefail

PASS=0
FAIL=0
WARN=0

print_header() {
  echo ""
  echo "========================================"
  echo " 자동 용량 권고 시스템 검증"
  echo " 검증 시각: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "========================================"
  echo ""
}

check_pass() { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
check_fail() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }
check_warn() { echo "  [WARN] $1"; WARN=$((WARN + 1)); }

check_config() {
  echo "--- 1. 설정 ConfigMap 검증 ---"
  if kubectl get configmap capacity-recommendation-config -n monitoring &>/dev/null; then
    check_pass "용량 권고 설정 ConfigMap 존재"
  else
    check_warn "용량 권고 설정 ConfigMap 미적용 (파일은 존재)"
  fi

  if [[ -f "/data/ai-saas/infra/capacity-recommendation/config.yaml" ]]; then
    check_pass "config.yaml 파일 존재"
  else
    check_fail "config.yaml 파일 없음"
  fi
}

check_prometheus_rules() {
  echo ""
  echo "--- 2. Prometheus 규칙 검증 ---"

  if [[ -f "/data/ai-saas/infra/capacity-recommendation/prometheus-rules.yaml" ]]; then
    check_pass "prometheus-rules.yaml 파일 존재"

    local recording_count alert_count
    recording_count=$(grep -c "record:" /data/ai-saas/infra/capacity-recommendation/prometheus-rules.yaml 2>/dev/null || echo "0")
    alert_count=$(grep -c "alert:" /data/ai-saas/infra/capacity-recommendation/prometheus-rules.yaml 2>/dev/null || echo "0")

    if [[ ${recording_count} -ge 10 ]]; then
      check_pass "레코딩 규칙 ${recording_count}개 정의"
    else
      check_warn "레코딩 규칙 부족 (${recording_count}개)"
    fi

    if [[ ${alert_count} -ge 3 ]]; then
      check_pass "알림 규칙 ${alert_count}개 정의"
    else
      check_warn "알림 규칙 부족 (${alert_count}개)"
    fi
  else
    check_fail "prometheus-rules.yaml 파일 없음"
  fi
}

check_grafana_dashboard() {
  echo ""
  echo "--- 3. Grafana 대시보드 검증 ---"

  if [[ -f "/data/ai-saas/infra/capacity-recommendation/grafana-dashboard.json" ]]; then
    check_pass "Grafana 대시보드 JSON 파일 존재"

    if python3 -c "import json; json.load(open('/data/ai-saas/infra/capacity-recommendation/grafana-dashboard.json'))" 2>/dev/null; then
      check_pass "대시보드 JSON 문법 유효"
    else
      check_fail "대시보드 JSON 문법 오류"
    fi
  else
    check_fail "Grafana 대시보드 파일 없음"
  fi
}

check_scripts() {
  echo ""
  echo "--- 4. 스크립트 검증 ---"

  local scripts=(
    "/data/ai-saas/scripts/capacity-recommendation-report.sh"
    "/data/ai-saas/scripts/verify-capacity-recommendation.sh"
  )

  for script in "${scripts[@]}"; do
    local name
    name=$(basename "${script}")
    if [[ -f "${script}" ]]; then
      check_pass "${name} 파일 존재"
      if [[ -x "${script}" ]]; then
        check_pass "${name} 실행 권한"
      else
        check_fail "${name} 실행 권한 없음"
      fi
    else
      check_fail "${name} 파일 없음"
    fi
  done
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
  check_config
  check_prometheus_rules
  check_grafana_dashboard
  check_scripts
  print_summary
  [[ ${FAIL} -gt 0 ]] && exit 1 || exit 0
}

main "$@"
