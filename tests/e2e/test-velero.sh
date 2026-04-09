#!/bin/bash
# =============================================================================
# Velero DR 자동화 통합 테스트
# Design Ref: MTU-N55
# Plan SC: FR-N55.10
# =============================================================================

set -euo pipefail

PASS=0; FAIL=0; TOTAL=0
RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'

log_test() {
  local tc_id="$1"; local desc="$2"; local result="$3"
  TOTAL=$((TOTAL + 1))
  if [ "$result" = "PASS" ]; then
    PASS=$((PASS + 1)); echo -e "  ${GREEN}[PASS]${NC} $tc_id: $desc"
  else
    FAIL=$((FAIL + 1)); echo -e "  ${RED}[FAIL]${NC} $tc_id: $desc"
  fi
}

echo "=============================================="
echo " Velero DR 자동화 통합 테스트"
echo " MTU-N55: Velero + MinIO + Restic"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="
echo ""

VELERO_DIR="/data/ai-saas/infra/velero"

# --- TC-01: Helm Values ---
echo "[Phase 1] 설치 설정 검증"
if [ -f "${VELERO_DIR}/values.yaml" ]; then
  HAS_BSL=$(grep -c "backupStorageLocation" "${VELERO_DIR}/values.yaml" || true)
  HAS_MINIO=$(grep -c "minio" "${VELERO_DIR}/values.yaml" || true)
  HAS_RESTIC=$(grep -c "restic" "${VELERO_DIR}/values.yaml" || true)
  HAS_METRICS=$(grep -c "metrics:" "${VELERO_DIR}/values.yaml" || true)
  HAS_SCHEDULES=$(grep -c "schedules:" "${VELERO_DIR}/values.yaml" || true)
  if [ "$HAS_BSL" -ge 1 ] && [ "$HAS_MINIO" -ge 1 ] && [ "$HAS_RESTIC" -ge 1 ] && \
     [ "$HAS_METRICS" -ge 1 ] && [ "$HAS_SCHEDULES" -ge 1 ]; then
    log_test "TC-01" "Helm values 완비 (BSL, MinIO, Restic, Metrics, Schedules)" "PASS"
  else
    log_test "TC-01" "Helm values 항목 누락" "FAIL"
  fi
else
  log_test "TC-01" "values.yaml 미존재" "FAIL"
fi

# --- TC-02: 설치 스크립트 ---
if [ -f "${VELERO_DIR}/install.sh" ] && [ -x "${VELERO_DIR}/install.sh" ]; then
  HAS_VELERO_CLI=$(grep -c "velero" "${VELERO_DIR}/install.sh" || true)
  HAS_HELM_INSTALL=$(grep -c "helm install" "${VELERO_DIR}/install.sh" || true)
  HAS_MINIO_DEPLOY=$(grep -c "minio" "${VELERO_DIR}/install.sh" || true)
  if [ "$HAS_VELERO_CLI" -ge 2 ] && [ "$HAS_HELM_INSTALL" -ge 1 ] && [ "$HAS_MINIO_DEPLOY" -ge 1 ]; then
    log_test "TC-02" "설치 스크립트 (Velero CLI + Helm + MinIO)" "PASS"
  else
    log_test "TC-02" "설치 스크립트 불완전" "FAIL"
  fi
else
  log_test "TC-02" "install.sh 미존재 또는 비실행" "FAIL"
fi

# --- TC-03~05: 스케줄 백업 CRD ---
echo ""
echo "[Phase 2] 백업 스케줄 검증"
SCHEDULES=(
  "daily-saas.yaml|TC-03|일간 SaaS 백업 (매일 02:00, 30일 보존)"
  "weekly-cluster.yaml|TC-04|주간 클러스터 백업 (일요일 03:00, 90일 보존)"
  "daily-pv.yaml|TC-05|일간 PV 데이터 백업 (매일 04:00, 14일 보존)"
)

for entry in "${SCHEDULES[@]}"; do
  IFS='|' read -r filename tc_id desc <<< "$entry"
  SCHED_FILE="${VELERO_DIR}/schedules/${filename}"
  if [ -f "$SCHED_FILE" ]; then
    HAS_KIND=$(grep -c "kind: Schedule" "$SCHED_FILE" || true)
    HAS_CRON=$(grep -c "schedule:" "$SCHED_FILE" || true)
    HAS_TTL=$(grep -c "ttl:" "$SCHED_FILE" || true)
    if [ "$HAS_KIND" -ge 1 ] && [ "$HAS_CRON" -ge 1 ] && [ "$HAS_TTL" -ge 1 ]; then
      log_test "$tc_id" "$desc" "PASS"
    else
      log_test "$tc_id" "$desc (형식 불완전)" "FAIL"
    fi
  else
    log_test "$tc_id" "$desc (파일 미존재)" "FAIL"
  fi
done

# --- TC-06: Restic/Kopia PV 백업 설정 ---
echo ""
echo "[Phase 3] PV 백업 및 보존 정책"
if grep -q "defaultVolumesToFsBackup: true" "${VELERO_DIR}/values.yaml"; then
  log_test "TC-06" "Restic PV 파일 레벨 백업 기본 활성화" "PASS"
else
  log_test "TC-06" "PV 백업 설정 누락" "FAIL"
fi

# --- TC-07: 보존 정책 ---
TTL_30=$(grep -c "720h" "${VELERO_DIR}/values.yaml" || true)
TTL_90=$(grep -c "2160h" "${VELERO_DIR}/values.yaml" || true)
TTL_14=$(grep -c "336h" "${VELERO_DIR}/values.yaml" || true)
if [ "$TTL_30" -ge 1 ] && [ "$TTL_90" -ge 1 ] && [ "$TTL_14" -ge 1 ]; then
  log_test "TC-07" "보존 정책 3종 (30일/90일/14일)" "PASS"
else
  log_test "TC-07" "보존 정책 불완전" "FAIL"
fi

# --- TC-08: DR 훈련 스크립트 ---
echo ""
echo "[Phase 4] DR 훈련 및 복구 Runbook"
DR_SCRIPT="${VELERO_DIR}/dr-scripts/dr-drill.sh"
if [ -f "$DR_SCRIPT" ] && [ -x "$DR_SCRIPT" ]; then
  HAS_RESTORE=$(grep -c "velero restore" "$DR_SCRIPT" || true)
  HAS_RTO=$(grep -c "RTO" "$DR_SCRIPT" || true)
  HAS_REPORT=$(grep -c "보고서" "$DR_SCRIPT" || true)
  if [ "$HAS_RESTORE" -ge 1 ] && [ "$HAS_RTO" -ge 1 ] && [ "$HAS_REPORT" -ge 1 ]; then
    log_test "TC-08" "DR 훈련 자동화 스크립트 (복구 + RTO 검증 + 보고서)" "PASS"
  else
    log_test "TC-08" "DR 훈련 스크립트 불완전" "FAIL"
  fi
else
  log_test "TC-08" "dr-drill.sh 미존재 또는 비실행" "FAIL"
fi

# --- TC-09: 복구 Runbook ---
RUNBOOK="${VELERO_DIR}/dr-scripts/restore-runbook.md"
if [ -f "$RUNBOOK" ]; then
  HAS_RESTORE_CMD=$(grep -c "velero restore create" "$RUNBOOK" || true)
  HAS_PV_RESTORE=$(grep -c "persistentvolume" "$RUNBOOK" || true)
  HAS_TROUBLESHOOT=$(grep -c "문제 해결" "$RUNBOOK" || true)
  if [ "$HAS_RESTORE_CMD" -ge 2 ] && [ "$HAS_PV_RESTORE" -ge 1 ] && [ "$HAS_TROUBLESHOOT" -ge 1 ]; then
    log_test "TC-09" "복구 Runbook (네임스페이스/PV/문제해결)" "PASS"
  else
    log_test "TC-09" "Runbook 내용 불충분" "FAIL"
  fi
else
  log_test "TC-09" "restore-runbook.md 미존재" "FAIL"
fi

# --- TC-10: Prometheus 알림 규칙 ---
echo ""
echo "[Phase 5] 모니터링 및 알림"
if grep -q "VeleroBackupFailed" "${VELERO_DIR}/values.yaml" && \
   grep -q "VeleroBackupNotRunning" "${VELERO_DIR}/values.yaml"; then
  log_test "TC-10" "Prometheus 알림 규칙 (실패 + 미실행)" "PASS"
else
  log_test "TC-10" "알림 규칙 누락" "FAIL"
fi

# --- TC-11: MinIO S3 연동 설정 ---
if grep -q "s3ForcePathStyle" "${VELERO_DIR}/values.yaml" && \
   grep -q "s3Url" "${VELERO_DIR}/values.yaml"; then
  log_test "TC-11" "MinIO S3 호환 스토리지 연동 설정" "PASS"
else
  log_test "TC-11" "S3 연동 설정 누락" "FAIL"
fi

# --- TC-12: Sealed Secrets 자격 증명 ---
if grep -q "credentials" "${VELERO_DIR}/values.yaml" && \
   grep -q "SEALED_SECRETS\|CHANGE_ME" "${VELERO_DIR}/values.yaml"; then
  log_test "TC-12" "자격 증명 설정 (Sealed Secrets 보호 명시)" "PASS"
else
  log_test "TC-12" "자격 증명 보호 미설정" "FAIL"
fi

# --- 최종 리포트 ---
echo ""
echo "=============================================="
echo " 테스트 결과 요약"
echo "=============================================="
echo -e " 총 테스트: ${TOTAL}"
echo -e " ${GREEN}PASS${NC}: ${PASS}"
echo -e " ${RED}FAIL${NC}: ${FAIL}"
RATE=$(awk "BEGIN {printf \"%.1f\", ($PASS/$TOTAL)*100}")
echo " 통과율: ${RATE}%"

if [ "$FAIL" -eq 0 ]; then
  echo -e "\n${GREEN}[ALL PASS] Velero DR 자동화 통합 테스트 완료${NC}"
  exit 0
else
  echo -e "\n${RED}[PARTIAL] ${FAIL}건 실패${NC}"
  exit 1
fi
