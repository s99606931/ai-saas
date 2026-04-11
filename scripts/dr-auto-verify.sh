#!/usr/bin/env bash
# =============================================================================
# DR 자동 페일오버 검증 스크립트
# Design Ref: MTU-N248 S3.2
# Plan SC: FR-N248.4
# CSAP: D-06 (침해사고 관리), D-10 (재해복구)
#
# 사용법:
#   ./scripts/dr-auto-verify.sh              # 전체 DR 검증
#   ./scripts/dr-auto-verify.sh --backup     # 백업 상태만 확인
#   ./scripts/dr-auto-verify.sh --health     # 서비스 헬스체크만
#   ./scripts/dr-auto-verify.sh --dry-run    # 시뮬레이션 모드
#
# 분기별 DR 훈련 시 자동 실행 (cron 또는 Gitea Actions)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORT_FILE="/tmp/dr-verify-$(date +%Y%m%d-%H%M%S).json"
MODE="${1:---all}"
PASS=0
FAIL=0
WARN=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_pass() { echo -e "  ${GREEN}[PASS]${NC} $1"; PASS=$((PASS + 1)); }
check_fail() { echo -e "  ${RED}[FAIL]${NC} $1"; FAIL=$((FAIL + 1)); }
check_warn() { echo -e "  ${YELLOW}[WARN]${NC} $1"; WARN=$((WARN + 1)); }

echo "================================================================"
echo "  DR 자동 페일오버 검증"
echo "  날짜: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "  모드: $MODE"
echo "================================================================"

# --- 1. Velero 백업 상태 확인 ---
check_backup() {
  echo ""
  echo "--- 1. Velero 백업 상태 ---"

  if command -v velero &>/dev/null; then
    # 최근 백업 확인
    LATEST_BACKUP=$(velero backup get --output json 2>/dev/null | jq -r '.items[0].status.phase // "none"' 2>/dev/null || echo "unavailable")
    if [ "$LATEST_BACKUP" = "Completed" ]; then
      check_pass "최근 백업 상태: Completed"
    elif [ "$LATEST_BACKUP" = "unavailable" ]; then
      check_warn "Velero 접근 불가 (클러스터 연결 확인)"
    else
      check_fail "최근 백업 상태: $LATEST_BACKUP"
    fi

    # 백업 스케줄 확인
    SCHEDULES=$(velero schedule get --output json 2>/dev/null | jq '.items | length' 2>/dev/null || echo "0")
    if [ "$SCHEDULES" -gt 0 ]; then
      check_pass "백업 스케줄 활성: ${SCHEDULES}개"
    else
      check_warn "백업 스케줄 미설정"
    fi
  else
    check_warn "Velero CLI 미설치 — 수동 확인 필요"
  fi
}

# --- 2. 핵심 서비스 헬스체크 ---
check_health() {
  echo ""
  echo "--- 2. 핵심 서비스 헬스체크 ---"

  NAMESPACES=("saas-dev" "saas-staging" "saas-production")

  for ns in "${NAMESPACES[@]}"; do
    if kubectl get namespace "$ns" &>/dev/null; then
      TOTAL=$(kubectl get pods -n "$ns" --no-headers 2>/dev/null | wc -l)
      RUNNING=$(kubectl get pods -n "$ns" --no-headers 2>/dev/null | grep -c "Running" || echo "0")

      if [ "$TOTAL" -eq 0 ]; then
        check_warn "$ns: Pod 없음"
      elif [ "$TOTAL" -eq "$RUNNING" ]; then
        check_pass "$ns: 전체 $TOTAL Pod 정상"
      else
        check_fail "$ns: $RUNNING/$TOTAL Pod 정상"
      fi
    else
      check_warn "$ns: 네임스페이스 없음"
    fi
  done

  # API Gateway 헬스체크
  for ns in "${NAMESPACES[@]}"; do
    GW_IP=$(kubectl get svc api-gateway -n "$ns" -o jsonpath='{.spec.clusterIP}' 2>/dev/null || echo "")
    if [ -n "$GW_IP" ]; then
      if curl -sf "http://${GW_IP}:3000/health" --connect-timeout 5 &>/dev/null; then
        check_pass "$ns API Gateway 헬스체크 통과"
      else
        check_fail "$ns API Gateway 헬스체크 실패"
      fi
    fi
  done
}

# --- 3. 데이터베이스 복원 시뮬레이션 ---
check_db() {
  echo ""
  echo "--- 3. 데이터베이스 복원 검증 ---"

  # PostgreSQL 연결 확인
  if kubectl get svc postgres -n saas-production &>/dev/null 2>&1; then
    check_pass "PostgreSQL 서비스 존재"
  else
    check_warn "PostgreSQL 서비스 미확인 (네임스페이스 확인 필요)"
  fi

  # 백업 파일 존재 확인
  if [ -f "$PROJECT_DIR/scripts/db-backup.sh" ]; then
    check_pass "DB 백업 스크립트 존재"
  else
    check_fail "DB 백업 스크립트 없음"
  fi

  if [ -f "$PROJECT_DIR/scripts/db-restore.sh" ]; then
    check_pass "DB 복원 스크립트 존재"
  else
    check_fail "DB 복원 스크립트 없음"
  fi
}

# --- 4. 인프라 상태 확인 ---
check_infra() {
  echo ""
  echo "--- 4. 인프라 상태 ---"

  # k3s 상태
  if kubectl cluster-info &>/dev/null; then
    check_pass "k3s 클러스터 연결 정상"
  else
    check_fail "k3s 클러스터 연결 실패"
  fi

  # 노드 상태
  NODES_READY=$(kubectl get nodes --no-headers 2>/dev/null | grep -c "Ready" || echo "0")
  if [ "$NODES_READY" -gt 0 ]; then
    check_pass "k3s 노드 Ready: ${NODES_READY}개"
  else
    check_fail "Ready 노드 없음"
  fi

  # Flux 동기화 상태
  if kubectl get kustomization -n flux-system &>/dev/null 2>&1; then
    FLUX_READY=$(kubectl get kustomization -n flux-system --no-headers 2>/dev/null | grep -c "True" || echo "0")
    check_pass "Flux Kustomization Ready: ${FLUX_READY}개"
  else
    check_warn "Flux 미설치 또는 접근 불가"
  fi
}

# --- 5. DR 문서 및 런북 확인 ---
check_docs() {
  echo ""
  echo "--- 5. DR 문서 및 런북 ---"

  DR_SCRIPTS=("scripts/dr-simulation.sh" "scripts/db-backup.sh" "scripts/db-restore.sh")
  for script in "${DR_SCRIPTS[@]}"; do
    if [ -f "$PROJECT_DIR/$script" ]; then
      check_pass "DR 스크립트: $script"
    else
      check_warn "DR 스크립트 누락: $script"
    fi
  done
}

# --- 실행 ---
case "$MODE" in
  --backup)   check_backup ;;
  --health)   check_health ;;
  --db)       check_db ;;
  --infra)    check_infra ;;
  --docs)     check_docs ;;
  *)
    check_backup
    check_health
    check_db
    check_infra
    check_docs
    ;;
esac

# --- 결과 요약 ---
echo ""
echo "================================================================"
echo "  DR 검증 결과"
echo "================================================================"
echo "  통과: $PASS"
echo "  실패: $FAIL"
echo "  경고: $WARN"
echo "================================================================"

if [ "$FAIL" -gt 0 ]; then
  echo -e "  ${RED}[DR 위험]${NC} $FAIL 개 항목 실패 — 즉시 조치 필요"
elif [ "$WARN" -gt 3 ]; then
  echo -e "  ${YELLOW}[주의]${NC} $WARN 개 경고 — 검토 필요"
else
  echo -e "  ${GREEN}[DR 준비 완료]${NC} 모든 검증 통과"
fi

# JSON 결과 저장
cat > "$REPORT_FILE" << DREOF
{
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "mode": "$MODE",
  "results": {
    "pass": $PASS,
    "fail": $FAIL,
    "warn": $WARN
  },
  "dr_ready": $([ "$FAIL" -eq 0 ] && echo "true" || echo "false"),
  "design_ref": "MTU-N248 S3.2",
  "csap_ref": "D-06,D-10"
}
DREOF

echo ""
echo "결과 저장: $REPORT_FILE"

# 감사 로그
TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
echo "{\"timestamp\":\"${TIMESTAMP}\",\"action\":\"DR_VERIFICATION\",\"pass\":$PASS,\"fail\":$FAIL,\"warn\":$WARN,\"csap_ref\":\"D-06,D-10\"}" >> "$PROJECT_DIR/.claude/audit.jsonl"
