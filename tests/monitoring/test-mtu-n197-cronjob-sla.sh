#!/bin/bash
# MTU-N197: CronJob SLA 모니터링 E2E 테스트
# Design Ref: MTU-N197.design.md
# Plan SC: FR-N197.6
set -euo pipefail

PASS=0
FAIL=0
TOTAL=0

check() {
  local desc="$1"
  local result="$2"
  TOTAL=$((TOTAL + 1))
  if [ "$result" = "0" ]; then
    echo "  [PASS] $desc"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $desc"
    FAIL=$((FAIL + 1))
  fi
}

echo "========================================"
echo "MTU-N197: CronJob SLA 모니터링 테스트"
echo "========================================"
echo ""

# --- Recording Rules ---
echo "[1/4] Recording Rules 파일 검증"
FILE="infra/monitoring/cronjob-sla-rules.yaml"
test -f "$FILE"; check "cronjob-sla-rules.yaml 파일 존재" $?
grep -q "cronjob_sla:success_rate_24h" "$FILE"; check "FR-N197.1: success_rate_24h recording rule" $?
grep -q "cronjob_sla:last_successful_time" "$FILE"; check "FR-N197.1: last_successful_time recording rule" $?
grep -q "cronjob_sla:since_last_success_seconds" "$FILE"; check "since_last_success_seconds recording rule" $?
grep -q "cronjob_sla:overdue_seconds" "$FILE"; check "FR-N197.3: overdue_seconds recording rule" $?
grep -q "cronjob_sla:job_duration_seconds" "$FILE"; check "FR-N197.4: job_duration_seconds recording rule" $?
grep -q "cronjob_sla:total_count" "$FILE"; check "total_count recording rule" $?
grep -q "cronjob_sla:suspended_count" "$FILE"; check "suspended_count recording rule" $?
grep -q "cronjob_sla:active_jobs_count" "$FILE"; check "active_jobs_count recording rule" $?
grep -q "cronjob_sla:failed_jobs_24h" "$FILE"; check "failed_jobs_24h recording rule" $?
grep -q "cronjob_sla:succeeded_jobs_24h" "$FILE"; check "succeeded_jobs_24h recording rule" $?
grep -q "kube_cronjob" "$FILE"; check "kube_cronjob 메트릭 참조" $?
grep -q "mtu: N197" "$FILE"; check "MTU 라벨 존재" $?
echo ""

# --- Alerting Rules ---
echo "[2/4] Alerting Rules 파일 검증"
FILE="infra/monitoring/cronjob-sla-alerts.yaml"
test -f "$FILE"; check "cronjob-sla-alerts.yaml 파일 존재" $?
grep -q "CronJobConsecutiveFailures" "$FILE"; check "FR-N197.2: CronJobConsecutiveFailures 알림" $?
grep -q "CronJobOverdue" "$FILE"; check "FR-N197.3: CronJobOverdue 알림" $?
grep -q "CronJobSLABreach" "$FILE"; check "FR-N197.1: CronJobSLABreach 알림" $?
grep -q "CronJobDurationAnomaly" "$FILE"; check "FR-N197.4: CronJobDurationAnomaly 알림" $?
grep -q "MultipleJobFailures" "$FILE"; check "MultipleJobFailures 알림" $?
grep -q "CronJobSuspended" "$FILE"; check "CronJobSuspended 알림" $?
grep -q "severity: critical" "$FILE"; check "critical 심각도 존재" $?
grep -q "severity: warning" "$FILE"; check "warning 심각도 존재" $?
grep -q "csap: D-06" "$FILE"; check "CSAP D-06 매핑" $?
grep -q "csap: D-10" "$FILE"; check "CSAP D-10 매핑" $?
grep -q "runbook_url" "$FILE"; check "Runbook URL 포함" $?
grep -q "mtu: N197" "$FILE"; check "MTU 라벨 존재" $?
echo ""

# --- 대시보드 ---
echo "[3/4] Grafana 대시보드 검증"
FILE="infra/monitoring/dashboards/cronjob-sla-dashboard.json"
test -f "$FILE"; check "cronjob-sla-dashboard.json 파일 존재" $?
python3 -c "import json; json.load(open('$FILE'))" 2>/dev/null; check "JSON 형식 유효성" $?
grep -q "cronjob_sla:success_rate_24h" "$FILE"; check "성공률 패널 존재" $?
grep -q "cronjob_sla:failed_jobs_24h" "$FILE"; check "실패 Job 패널 존재" $?
grep -q "cronjob_sla:succeeded_jobs_24h" "$FILE"; check "성공 Job 패널 존재" $?
grep -q "cronjob_sla:since_last_success_seconds" "$FILE"; check "마지막 성공 경과 패널 존재" $?
grep -q "cronjob_sla:job_duration_seconds" "$FILE"; check "실행 소요 시간 패널 존재" $?
echo ""

# --- YAML 유효성 ---
echo "[4/4] YAML 유효성 검증"
for f in infra/monitoring/cronjob-sla-rules.yaml infra/monitoring/cronjob-sla-alerts.yaml; do
  python3 -c "import yaml; yaml.safe_load(open('$f'))" 2>/dev/null; check "$f YAML 유효성" $?
done
echo ""

# --- 결과 ---
echo "========================================"
echo "테스트 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "========================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
