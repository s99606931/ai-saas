#!/usr/bin/env bash
# Design Ref: MTU-N159 Section 3.1
# Plan SC: FR-N159.2
# CSAP: D-08 네트워크 접근 통제
#
# 토폴로지 존 레이블 설정 스크립트
# k3s 클러스터 노드에 topology.kubernetes.io/zone 레이블 자동 할당

set -euo pipefail

readonly SCRIPT_NAME="setup-topology-labels"
readonly REGION="${TOPOLOGY_REGION:-kr-central}"
readonly ZONES=("zone-a" "zone-b" "zone-c")
readonly LOG_FILE="/var/log/saas/${SCRIPT_NAME}.log"

log() {
  local level="$1"; shift
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [${level}] ${SCRIPT_NAME}: $*" | tee -a "${LOG_FILE}" 2>/dev/null || true
}

usage() {
  cat <<EOF
사용법: $0 [옵션]

토폴로지 존 레이블 설정 스크립트
k3s 클러스터 노드에 zone/region 레이블을 자동 할당합니다.

옵션:
  --dry-run          실제 적용하지 않고 변경 내용만 출력
  --single-node      단일 노드 모드 (zone-a만 할당)
  --verify           현재 레이블 상태 확인
  --help             도움말 출력

환경 변수:
  TOPOLOGY_REGION    리전 이름 (기본: kr-central)
  KUBECONFIG         kubeconfig 경로

예시:
  $0 --dry-run           # 변경 내용 미리보기
  $0 --single-node       # WSL2 단일 노드 설정
  $0 --verify            # 현재 상태 확인
EOF
}

check_prerequisites() {
  if ! command -v kubectl &>/dev/null; then
    log "ERROR" "kubectl이 설치되어 있지 않습니다"
    exit 1
  fi

  if ! kubectl cluster-info &>/dev/null; then
    log "ERROR" "클러스터에 연결할 수 없습니다"
    exit 1
  fi

  log "INFO" "사전 조건 확인 완료"
}

get_nodes() {
  kubectl get nodes -o jsonpath='{.items[*].metadata.name}' | tr ' ' '\n'
}

verify_labels() {
  log "INFO" "현재 토폴로지 레이블 상태 확인"
  echo ""
  echo "=== 노드 토폴로지 레이블 현황 ==="
  kubectl get nodes -o custom-columns=\
'NAME:.metadata.name,ZONE:.metadata.labels.topology\.kubernetes\.io/zone,REGION:.metadata.labels.topology\.kubernetes\.io/region,READY:.status.conditions[?(@.type=="Ready")].status'
  echo ""

  local nodes_without_zone
  nodes_without_zone=$(kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.metadata.labels.topology\.kubernetes\.io/zone}{"\n"}{end}' | grep -c $'\t$' || true)

  if [[ "${nodes_without_zone}" -gt 0 ]]; then
    log "WARN" "${nodes_without_zone}개 노드에 zone 레이블이 없습니다"
  else
    log "INFO" "모든 노드에 zone 레이블이 설정되어 있습니다"
  fi
}

apply_labels() {
  local dry_run="$1"
  local single_node="$2"
  local nodes
  local zone_index=0

  mapfile -t nodes < <(get_nodes)
  local node_count=${#nodes[@]}

  if [[ "${node_count}" -eq 0 ]]; then
    log "ERROR" "클러스터에 노드가 없습니다"
    exit 1
  fi

  log "INFO" "노드 ${node_count}개 발견, 레이블 할당 시작"

  for node in "${nodes[@]}"; do
    local zone

    if [[ "${single_node}" == "true" ]]; then
      zone="${ZONES[0]}"
    else
      zone="${ZONES[$((zone_index % ${#ZONES[@]}))]}"
      zone_index=$((zone_index + 1))
    fi

    local cmd="kubectl label node ${node} topology.kubernetes.io/zone=${zone} topology.kubernetes.io/region=${REGION} --overwrite"

    if [[ "${dry_run}" == "true" ]]; then
      log "INFO" "[DRY-RUN] ${cmd}"
    else
      if eval "${cmd}"; then
        log "INFO" "노드 ${node}: zone=${zone}, region=${REGION} 레이블 적용 완료"
      else
        log "ERROR" "노드 ${node} 레이블 적용 실패"
        exit 1
      fi
    fi
  done

  log "INFO" "토폴로지 레이블 할당 완료 (${node_count}개 노드)"
}

main() {
  local dry_run="false"
  local single_node="false"
  local verify_only="false"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run)     dry_run="true"; shift ;;
      --single-node) single_node="true"; shift ;;
      --verify)      verify_only="true"; shift ;;
      --help)        usage; exit 0 ;;
      *)             log "ERROR" "알 수 없는 옵션: $1"; usage; exit 1 ;;
    esac
  done

  mkdir -p "$(dirname "${LOG_FILE}")" 2>/dev/null || true

  log "INFO" "토폴로지 레이블 설정 시작 (region=${REGION})"
  check_prerequisites

  if [[ "${verify_only}" == "true" ]]; then
    verify_labels
    exit 0
  fi

  apply_labels "${dry_run}" "${single_node}"
  verify_labels

  log "INFO" "토폴로지 레이블 설정 완료"
}

main "$@"
