#!/usr/bin/env bash
# =============================================================================
# 자동 Runbook: 디스크 용량 부족 진단 + 자동 정리
# Design Ref: MTU-N94 Design §2.2
# Plan SC: FR-N94.3, FR-N94.5
# CSAP: D-06(인시던트 자동 진단)
#
# 사용법: bash scripts/runbook-auto-disk-cleanup.sh [mountpoint]
# 예시:   bash scripts/runbook-auto-disk-cleanup.sh /
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNBOOK_NAME="disk-cleanup-diag"
source "$SCRIPT_DIR/runbook-lib.sh"

MOUNTPOINT="${1:-/}"

section "디스크 용량 부족 자동 진단"
log_info "마운트포인트: $MOUNTPOINT"
log_audit "RUNBOOK_START" "디스크 진단 시작: $MOUNTPOINT"

# ---------------------------------------------------------------------------
# STEP 1: 현재 디스크 상태
# ---------------------------------------------------------------------------
section "STEP 1: 디스크 상태 확인"

DISK_USAGE=$(df -h "$MOUNTPOINT" | tail -1)
DISK_PERCENT=$(df "$MOUNTPOINT" | tail -1 | awk '{print $5}' | tr -d '%')
DISK_AVAIL=$(df -h "$MOUNTPOINT" | tail -1 | awk '{print $4}')

log_info "디스크 사용률: ${DISK_PERCENT}%"
log_info "잔여 용량: $DISK_AVAIL"
add_finding "disk_status" "info" "사용률: ${DISK_PERCENT}%, 잔여: $DISK_AVAIL"

# ---------------------------------------------------------------------------
# STEP 2: 대용량 파일 탐색
# ---------------------------------------------------------------------------
section "STEP 2: 대용량 파일 탐색 (100MB+)"

LARGE_FILES=$(find "$MOUNTPOINT" -xdev -type f -size +100M -exec ls -lh {} \; 2>/dev/null | sort -k5 -rh | head -10 || echo "탐색 실패")
if [ -n "$LARGE_FILES" ] && [ "$LARGE_FILES" != "탐색 실패" ]; then
  log_info "대용량 파일 발견:"
  echo "$LARGE_FILES"
  FILE_COUNT=$(echo "$LARGE_FILES" | wc -l)
  add_finding "large_files" "warning" "100MB 이상 파일 ${FILE_COUNT}개 발견"
else
  log_success "100MB 이상 대용량 파일 없음"
fi

# ---------------------------------------------------------------------------
# STEP 3: 로그 파일 분석
# ---------------------------------------------------------------------------
section "STEP 3: 로그 디렉토리 분석"

LOG_DIRS=("/var/log" "/tmp" "/var/tmp")
for dir in "${LOG_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    DIR_SIZE=$(du -sh "$dir" 2>/dev/null | awk '{print $1}' || echo "측정 불가")
    log_info "$dir: $DIR_SIZE"
    add_finding "log_dir" "info" "$dir 크기: $DIR_SIZE"
  fi
done

# ---------------------------------------------------------------------------
# STEP 4: 안전한 자동 정리 (80% 이상일 때만)
# ---------------------------------------------------------------------------
section "STEP 4: 자동 정리 판단"

AUTO_ACTION="none"
AUTO_REASON="디스크 사용률 정상 범위"

if [ "$DISK_PERCENT" -gt 80 ]; then
  log_warn "디스크 사용률 ${DISK_PERCENT}% — 자동 정리 실행"

  # 안전한 정리 항목만 수행
  # 1. 오래된 systemd 저널 정리
  if command -v journalctl &>/dev/null; then
    log_info "systemd 저널 정리 (7일 이전)..."
    # journalctl --vacuum-time=7d 2>/dev/null || true
    add_action "journal_vacuum" "systemd 저널 7일 이전 정리" "dry_run"
  fi

  # 2. /tmp 30일 이상 파일 정리
  OLD_TMP=$(find /tmp -type f -mtime +30 2>/dev/null | wc -l || echo 0)
  if [ "$OLD_TMP" -gt 0 ]; then
    log_info "/tmp 30일 이상 파일 ${OLD_TMP}개 발견"
    # find /tmp -type f -mtime +30 -delete 2>/dev/null || true
    add_action "tmp_cleanup" "/tmp 30일 이상 파일 ${OLD_TMP}개 정리" "dry_run"
  fi

  # 3. 컨테이너 로그 확인 (k8s 환경)
  if command -v crictl &>/dev/null; then
    log_info "미사용 컨테이너 이미지 확인..."
    # crictl rmi --prune 2>/dev/null || true
    add_action "container_image_prune" "미사용 컨테이너 이미지 정리" "dry_run"
  fi

  AUTO_ACTION="dry_run"
  AUTO_REASON="디스크 사용률 ${DISK_PERCENT}% — 정리 대상 식별 완료 (실제 삭제는 수동 승인 필요)"
else
  log_success "디스크 사용률 정상 (${DISK_PERCENT}%) — 정리 불필요"
fi

# ---------------------------------------------------------------------------
# STEP 5: 근본 원인 + 권장 조치
# ---------------------------------------------------------------------------
section "STEP 5: 진단 결과"

ROOT_CAUSE="디스크 사용률 ${DISK_PERCENT}%"
RECOMMENDATION="정상 범위"

if [ "$DISK_PERCENT" -gt 90 ]; then
  ROOT_CAUSE="디스크 용량 위험 수준 (${DISK_PERCENT}%)"
  RECOMMENDATION="즉시 로그 정리 + PV 크기 확장 필요"
elif [ "$DISK_PERCENT" -gt 80 ]; then
  ROOT_CAUSE="디스크 용량 경고 수준 (${DISK_PERCENT}%)"
  RECOMMENDATION="정기 로그 로테이션 설정 + 불필요 파일 정리"
fi

output_diagnosis "$ROOT_CAUSE" "$RECOMMENDATION" "$AUTO_ACTION" "$AUTO_REASON"

log_audit "RUNBOOK_COMPLETE" "디스크 진단 완료: $ROOT_CAUSE"
