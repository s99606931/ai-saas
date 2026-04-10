#!/bin/bash
# MTU-N183: Job/CronJob 모니터링 검증 스크립트
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0
check() { TOTAL=$((TOTAL+1)); if [ "$2" = "0" ]; then echo "[PASS] $1"; PASS=$((PASS+1)); else echo "[FAIL] $1"; FAIL=$((FAIL+1)); fi; }

echo "============================================"
echo "MTU-N183: Job/CronJob 모니터링 검증"
echo "일시: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"

R="infra/monitoring/job-cronjob-rules.yaml"
D="infra/monitoring/dashboards/job-cronjob.json"

echo "--- 파일 구조 ---"
check "PrometheusRule 존재" "$(test -f "$R" && echo 0 || echo 1)"
check "kind: PrometheusRule" "$(grep -q 'kind: PrometheusRule' "$R" && echo 0 || echo 1)"
check "대시보드 존재" "$(test -f "$D" && echo 0 || echo 1)"
check "JSON 유효성" "$(python3 -c 'import json; json.load(open("'"$D"'"))' 2>/dev/null && echo 0 || echo 1)"
check "CSAP D-06 라벨" "$(grep -q 'csap-control: D-06' "$R" && echo 0 || echo 1)"

echo ""
echo "--- FR-N183.1: Job 성공/실패 ---"
check "failed_count recording" "$(grep -q 'namespace:job:failed_count' "$R" && echo 0 || echo 1)"
check "succeeded_count recording" "$(grep -q 'namespace:job:succeeded_count' "$R" && echo 0 || echo 1)"
check "active_count recording" "$(grep -q 'namespace:job:active_count' "$R" && echo 0 || echo 1)"
check "KubeJobFailed 알림" "$(grep -q 'KubeJobFailed' "$R" && echo 0 || echo 1)"
check "KubeJobRepeatedFailure 알림" "$(grep -q 'KubeJobRepeatedFailure' "$R" && echo 0 || echo 1)"

echo ""
echo "--- FR-N183.2: CronJob 스케줄 누락 ---"
check "time_since_last_schedule recording" "$(grep -q 'namespace:cronjob:time_since_last_schedule' "$R" && echo 0 || echo 1)"
check "time_since_last_success recording" "$(grep -q 'namespace:cronjob:time_since_last_success' "$R" && echo 0 || echo 1)"
check "CronJobMissedSchedule 알림" "$(grep -q 'CronJobMissedSchedule' "$R" && echo 0 || echo 1)"
check "CronJobLongNotRun 알림" "$(grep -q 'CronJobLongNotRun' "$R" && echo 0 || echo 1)"

echo ""
echo "--- FR-N183.3: 장시간 실행 ---"
check "running_duration recording" "$(grep -q 'namespace:job:running_duration_seconds' "$R" && echo 0 || echo 1)"
check "completion_duration recording" "$(grep -q 'namespace:job:completion_duration_seconds' "$R" && echo 0 || echo 1)"
check "KubeJobRunningLong 알림" "$(grep -q 'KubeJobRunningLong' "$R" && echo 0 || echo 1)"
check "KubeJobRunningVeryLong 알림" "$(grep -q 'KubeJobRunningVeryLong' "$R" && echo 0 || echo 1)"

echo ""
echo "--- FR-N183.4: 대시보드 ---"
check "실패 Job 패널" "$(grep -q 'failed_count' "$D" && echo 0 || echo 1)"
check "CronJob 경과 패널" "$(grep -q 'time_since_last_schedule' "$D" && echo 0 || echo 1)"
check "실행 시간 패널" "$(grep -q 'running_duration' "$D" && echo 0 || echo 1)"
check "성공률 패널" "$(grep -q 'success_rate' "$D" && echo 0 || echo 1)"
check "건강 점수 패널" "$(grep -q 'health_score' "$D" && echo 0 || echo 1)"

echo ""
echo "--- FR-N183.5/6: 재시도/성공률 ---"
check "success_rate recording" "$(grep -q 'namespace:job:success_rate' "$R" && echo 0 || echo 1)"
check "cluster success_rate recording" "$(grep -q 'cluster:job:success_rate' "$R" && echo 0 || echo 1)"
check "suspended_count recording" "$(grep -q 'cluster:cronjob:suspended_count' "$R" && echo 0 || echo 1)"
check "JobSuccessRateLow 알림" "$(grep -q 'JobSuccessRateLow' "$R" && echo 0 || echo 1)"
check "JobHealthScoreLow 알림" "$(grep -q 'JobHealthScoreLow' "$R" && echo 0 || echo 1)"
check "JobHealthScoreCritical 알림" "$(grep -q 'JobHealthScoreCritical' "$R" && echo 0 || echo 1)"
check "health_score recording" "$(grep -q 'cluster:job:health_score' "$R" && echo 0 || echo 1)"

echo ""
echo "--- 보안 ---"
check "시크릿 없음 (rules)" "$(grep -qiE '(password|secret|token|api.?key)\s*[:=]' "$R" && echo 1 || echo 0)"
check "시크릿 없음 (dashboard)" "$(grep -qiE '(password|secret|token|api.?key)\s*[:=]' "$D" && echo 1 || echo 0)"

echo ""
echo "============================================"
echo "검증 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "============================================"
if [ "$FAIL" -gt 0 ]; then exit 1; fi
echo "모든 검증 통과"
