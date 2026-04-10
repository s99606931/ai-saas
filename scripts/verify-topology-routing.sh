#!/usr/bin/env bash
# Design Ref: MTU-N159 Section 3
# Plan SC: FR-N159.1 ~ FR-N159.7
# CSAP: D-08 네트워크 접근 통제 검증
#
# 토폴로지 인식 라우팅 검증 스크립트
# TAR 설정, 레이블, EndpointSlice 힌트, Linkerd 연동 상태 종합 점검

set -euo pipefail

readonly NAMESPACE="${TARGET_NAMESPACE:-public-saas}"
readonly EXPECTED_ZONE_LABEL="topology.kubernetes.io/zone"
readonly EXPECTED_REGION_LABEL="topology.kubernetes.io/region"

PASS=0
FAIL=0
WARN=0

print_header() {
  echo ""
  echo "========================================"
  echo " 토폴로지 인식 라우팅 검증"
  echo " 대상 네임스페이스: ${NAMESPACE}"
  echo " 검증 시각: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "========================================"
  echo ""
}

check_pass() {
  echo "  [PASS] $1"
  PASS=$((PASS + 1))
}

check_fail() {
  echo "  [FAIL] $1"
  FAIL=$((FAIL + 1))
}

check_warn() {
  echo "  [WARN] $1"
  WARN=$((WARN + 1))
}

# 1. 노드 토폴로지 레이블 확인
check_node_labels() {
  echo "--- 1. 노드 토폴로지 레이블 검증 ---"

  local nodes
  nodes=$(kubectl get nodes -o jsonpath='{.items[*].metadata.name}')

  for node in ${nodes}; do
    local zone
    zone=$(kubectl get node "${node}" -o jsonpath="{.metadata.labels.${EXPECTED_ZONE_LABEL}}" 2>/dev/null || echo "")

    local region
    region=$(kubectl get node "${node}" -o jsonpath="{.metadata.labels.${EXPECTED_REGION_LABEL}}" 2>/dev/null || echo "")

    if [[ -n "${zone}" ]]; then
      check_pass "노드 ${node}: zone=${zone}"
    else
      check_fail "노드 ${node}: zone 레이블 없음"
    fi

    if [[ -n "${region}" ]]; then
      check_pass "노드 ${node}: region=${region}"
    else
      check_warn "노드 ${node}: region 레이블 없음"
    fi
  done
}

# 2. 서비스 TAR 어노테이션 확인
check_service_annotations() {
  echo ""
  echo "--- 2. 서비스 TAR 어노테이션 검증 ---"

  local services
  services=$(kubectl get svc -n "${NAMESPACE}" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")

  if [[ -z "${services}" ]]; then
    check_warn "네임스페이스 ${NAMESPACE}에 서비스가 없습니다"
    return
  fi

  for svc in ${services}; do
    local topology_mode
    topology_mode=$(kubectl get svc "${svc}" -n "${NAMESPACE}" \
      -o jsonpath='{.metadata.annotations.service\.kubernetes\.io/topology-mode}' 2>/dev/null || echo "")

    if [[ "${topology_mode}" == "Auto" ]]; then
      check_pass "서비스 ${svc}: topology-mode=Auto"
    else
      check_warn "서비스 ${svc}: topology-mode 미설정 (현재: '${topology_mode}')"
    fi
  done
}

# 3. EndpointSlice 힌트 확인
check_endpoint_hints() {
  echo ""
  echo "--- 3. EndpointSlice 힌트 검증 ---"

  local slices
  slices=$(kubectl get endpointslice -n "${NAMESPACE}" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")

  if [[ -z "${slices}" ]]; then
    check_warn "EndpointSlice가 없습니다"
    return
  fi

  local hint_count=0
  local total_count=0

  for slice in ${slices}; do
    total_count=$((total_count + 1))
    local hints
    hints=$(kubectl get endpointslice "${slice}" -n "${NAMESPACE}" \
      -o jsonpath='{.endpoints[*].hints}' 2>/dev/null || echo "")

    if [[ -n "${hints}" ]]; then
      hint_count=$((hint_count + 1))
    fi
  done

  if [[ ${total_count} -gt 0 ]]; then
    echo "  EndpointSlice 총: ${total_count}개, 힌트 할당: ${hint_count}개"
    if [[ ${hint_count} -eq ${total_count} ]]; then
      check_pass "모든 EndpointSlice에 힌트가 할당됨"
    elif [[ ${hint_count} -gt 0 ]]; then
      check_warn "일부 EndpointSlice에 힌트 미할당 (${hint_count}/${total_count})"
    else
      check_warn "EndpointSlice 힌트 미할당 (엔드포인트 수 < 존 수일 수 있음)"
    fi
  fi
}

# 4. Linkerd 서비스 프로파일 확인
check_linkerd_profiles() {
  echo ""
  echo "--- 4. Linkerd 서비스 프로파일 검증 ---"

  if ! kubectl api-resources | grep -q "serviceprofiles"; then
    check_warn "Linkerd ServiceProfile CRD가 설치되어 있지 않습니다"
    return
  fi

  local profiles
  profiles=$(kubectl get serviceprofile -n "${NAMESPACE}" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")

  if [[ -z "${profiles}" ]]; then
    check_warn "Linkerd ServiceProfile이 없습니다"
  else
    for profile in ${profiles}; do
      check_pass "ServiceProfile: ${profile}"
    done
  fi
}

# 5. 페일오버 정책 ConfigMap 확인
check_failover_policy() {
  echo ""
  echo "--- 5. 페일오버 정책 검증 ---"

  if kubectl get configmap topology-failover-policy -n "${NAMESPACE}" &>/dev/null; then
    check_pass "페일오버 정책 ConfigMap 존재"
  else
    check_fail "페일오버 정책 ConfigMap 없음"
  fi
}

# 6. Prometheus 규칙 확인
check_prometheus_rules() {
  echo ""
  echo "--- 6. Prometheus 모니터링 규칙 검증 ---"

  if kubectl api-resources | grep -q "prometheusrules"; then
    if kubectl get prometheusrule topology-routing-rules -n monitoring &>/dev/null; then
      check_pass "Prometheus 토폴로지 라우팅 규칙 존재"
    else
      check_warn "Prometheus 토폴로지 라우팅 규칙 미적용"
    fi
  else
    check_warn "PrometheusRule CRD가 설치되어 있지 않습니다"
  fi
}

# 결과 요약
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
    echo "  상태: 정상 (모든 필수 항목 통과)"
  else
    echo "  상태: 주의 필요 (${FAIL}개 항목 실패)"
  fi
  echo "========================================"
}

main() {
  print_header
  check_node_labels
  check_service_annotations
  check_endpoint_hints
  check_linkerd_profiles
  check_failover_policy
  check_prometheus_rules
  print_summary

  if [[ ${FAIL} -gt 0 ]]; then
    exit 1
  fi
}

main "$@"
