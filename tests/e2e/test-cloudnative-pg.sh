#!/bin/bash
# =============================================================================
# MTU-N64: CloudNativePG PostgreSQL Operator 검증
# Design Ref: MTU-N64.design.md §1~§4
# Plan SC: FR-N64.1~FR-N64.7
# =============================================================================

set -euo pipefail

PASS=0
FAIL=0
TOTAL=0
CNPG_DIR="/data/ai-saas/infra/cloudnative-pg"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

run_test() {
  local id="$1" desc="$2" cmd="$3"
  TOTAL=$((TOTAL + 1))
  if eval "$cmd" > /dev/null 2>&1; then
    echo -e "  ${GREEN}[PASS]${NC} ${id}: ${desc}"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}[FAIL]${NC} ${id}: ${desc}"
    FAIL=$((FAIL + 1))
  fi
}

echo "============================================================"
echo " MTU-N64: CloudNativePG PostgreSQL Operator 검증"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"

# --- FR-N64.1: Helm values ---
echo ""
echo "--- FR-N64.1: Helm values ---"

run_test "TC-01" "values.yaml 존재" \
  "[ -f '${CNPG_DIR}/values.yaml' ]"

run_test "TC-02" "PodMonitor 활성화" \
  "grep -q 'podMonitorEnabled: true' '${CNPG_DIR}/values.yaml'"

run_test "TC-03" "보안 컨텍스트 runAsNonRoot" \
  "grep -q 'runAsNonRoot: true' '${CNPG_DIR}/values.yaml'"

# --- FR-N64.2: HA 클러스터 ---
echo ""
echo "--- FR-N64.2: HA 클러스터 ---"

run_test "TC-04" "클러스터 매니페스트 존재" \
  "[ -f '${CNPG_DIR}/clusters/saas-main-db.yaml' ]"

run_test "TC-05" "인스턴스 3개 (HA)" \
  "grep -q 'instances: 3' '${CNPG_DIR}/clusters/saas-main-db.yaml'"

run_test "TC-06" "PostgreSQL 16 이미지" \
  "grep -q 'postgresql:16' '${CNPG_DIR}/clusters/saas-main-db.yaml'"

run_test "TC-07" "SSL 필수 (CSAP D-09)" \
  "grep -q 'ssl: .on.' '${CNPG_DIR}/clusters/saas-main-db.yaml'"

run_test "TC-08" "scram-sha-256 인증" \
  "grep -q 'scram-sha-256' '${CNPG_DIR}/clusters/saas-main-db.yaml'"

run_test "TC-09" "감사 로깅 (log_statement)" \
  "grep -q 'log_statement' '${CNPG_DIR}/clusters/saas-main-db.yaml'"

run_test "TC-10" "Anti-Affinity 설정" \
  "grep -q 'enablePodAntiAffinity: true' '${CNPG_DIR}/clusters/saas-main-db.yaml'"

# --- FR-N64.3: 백업 ---
echo ""
echo "--- FR-N64.3: 백업 ---"

run_test "TC-11" "WAL 아카이빙 MinIO 설정" \
  "grep -q 'barmanObjectStore' '${CNPG_DIR}/clusters/saas-main-db.yaml'"

run_test "TC-12" "스케줄 백업 매니페스트 존재" \
  "[ -f '${CNPG_DIR}/backups/scheduled-backup.yaml' ]"

run_test "TC-13" "스케줄 백업 cron 설정" \
  "grep -q 'schedule:' '${CNPG_DIR}/backups/scheduled-backup.yaml'"

# --- FR-N64.4: cert-manager TLS ---
echo ""
echo "--- FR-N64.4: cert-manager TLS ---"

run_test "TC-14" "DB TLS Certificate 정의" \
  "grep -q 'kind: Certificate' '${CNPG_DIR}/backups/scheduled-backup.yaml'"

# --- FR-N64.5: Prometheus 알림 ---
echo ""
echo "--- FR-N64.5: Prometheus 알림 ---"

run_test "TC-15" "alerting-rules.yaml 존재" \
  "[ -f '${CNPG_DIR}/alerting-rules.yaml' ]"

run_test "TC-16" "복제 지연 알림" \
  "grep -q 'CNPGReplicationLag' '${CNPG_DIR}/alerting-rules.yaml'"

run_test "TC-17" "WAL 아카이빙 실패 알림" \
  "grep -q 'CNPGWALArchiveFailed' '${CNPG_DIR}/alerting-rules.yaml'"

# --- 결과 ---
echo ""
echo "============================================================"
echo " 결과: PASS: ${PASS} / FAIL: ${FAIL} / 총: ${TOTAL}"
if [ "${TOTAL}" -gt 0 ]; then
  RATE=$(awk "BEGIN {printf \"%.1f\", (${PASS}/${TOTAL})*100}")
  echo " 통과율: ${RATE}%"
fi
echo "============================================================"

if [ "${FAIL}" -eq 0 ]; then
  echo -e "\n${GREEN}[ALL PASS] MTU-N64 CloudNativePG 검증 완료${NC}"
  exit 0
else
  echo -e "\n${RED}[PARTIAL] ${FAIL}건 실패${NC}"
  exit 1
fi
