#!/bin/bash
# MTU-N180: 컨테이너 런타임 모니터링 검증 스크립트
# Design Ref: DESIGN-N180
# Plan SC: FR-N180.1 ~ FR-N180.6
set -euo pipefail

PASS=0
FAIL=0
TOTAL=0

check() {
  local desc="$1"
  local result="$2"
  TOTAL=$((TOTAL + 1))
  if [ "$result" = "0" ]; then
    echo "[PASS] $desc"
    PASS=$((PASS + 1))
  else
    echo "[FAIL] $desc"
    FAIL=$((FAIL + 1))
  fi
}

echo "============================================"
echo "MTU-N180: 컨테이너 런타임 모니터링 검증"
echo "일시: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"
echo ""

RULES_FILE="infra/monitoring/container-runtime-rules.yaml"
DASHBOARD_FILE="infra/monitoring/dashboards/container-runtime.json"

# TC-N180.1: containerd 런타임 상태 모니터링
echo "--- TC-N180.1: containerd 런타임 상태 ---"
check "PrometheusRule 파일 존재" "$(test -f "$RULES_FILE" && echo 0 || echo 1)"
check "kind: PrometheusRule" "$(grep -q 'kind: PrometheusRule' "$RULES_FILE" && echo 0 || echo 1)"
check "containerd operations_rate recording rule" "$(grep -q 'node:containerd:operations_rate' "$RULES_FILE" && echo 0 || echo 1)"
check "containerd operations_errors_rate recording rule" "$(grep -q 'node:containerd:operations_errors_rate' "$RULES_FILE" && echo 0 || echo 1)"
check "containerd operations_duration_p99 recording rule" "$(grep -q 'node:containerd:operations_duration_p99' "$RULES_FILE" && echo 0 || echo 1)"
check "실행 중 컨테이너 수 recording rule" "$(grep -q 'cluster:container:running_count' "$RULES_FILE" && echo 0 || echo 1)"
check "컨테이너 상태별 수량 recording rule" "$(grep -q 'cluster:container:status_count' "$RULES_FILE" && echo 0 || echo 1)"
check "ContainerdOperationErrors 알림" "$(grep -q 'ContainerdOperationErrors' "$RULES_FILE" && echo 0 || echo 1)"
check "ContainerdOperationSlow 알림" "$(grep -q 'ContainerdOperationSlow' "$RULES_FILE" && echo 0 || echo 1)"
check "CSAP D-12 라벨" "$(grep -q 'csap-control: D-12' "$RULES_FILE" && echo 0 || echo 1)"

# TC-N180.2: 이미지 풀 지연 모니터링
echo ""
echo "--- TC-N180.2: 이미지 풀 지연 모니터링 ---"
check "이미지 풀 P50 recording rule" "$(grep -q 'cluster:image:pull_duration_p50' "$RULES_FILE" && echo 0 || echo 1)"
check "이미지 풀 P99 recording rule" "$(grep -q 'cluster:image:pull_duration_p99' "$RULES_FILE" && echo 0 || echo 1)"
check "이미지 크기 P99 recording rule" "$(grep -q 'cluster:image:size_p99' "$RULES_FILE" && echo 0 || echo 1)"
check "ImagePullSlowP99 알림" "$(grep -q 'ImagePullSlowP99' "$RULES_FILE" && echo 0 || echo 1)"
check "ImagePullSlowCritical 알림" "$(grep -q 'ImagePullSlowCritical' "$RULES_FILE" && echo 0 || echo 1)"

# TC-N180.3: OOM Kill 모니터링
echo ""
echo "--- TC-N180.3: OOM Kill 모니터링 ---"
check "OOM Kill 1시간 recording rule" "$(grep -q 'cluster:container:oom_kills_1h' "$RULES_FILE" && echo 0 || echo 1)"
check "네임스페이스별 OOM Kill recording rule" "$(grep -q 'namespace:container:oom_kills_1h' "$RULES_FILE" && echo 0 || echo 1)"
check "ContainerOOMKilled 알림" "$(grep -q 'ContainerOOMKilled' "$RULES_FILE" && echo 0 || echo 1)"
check "ContainerOOMKilledFrequent 알림" "$(grep -q 'ContainerOOMKilledFrequent' "$RULES_FILE" && echo 0 || echo 1)"
check "CSAP D-06 라벨" "$(grep -q 'csap_control: D-06' "$RULES_FILE" && echo 0 || echo 1)"

# TC-N180.4: CrashLoop 탐지
echo ""
echo "--- TC-N180.4: CrashLoopBackOff 탐지 ---"
check "CrashLoop 수 recording rule" "$(grep -q 'cluster:container:crashloop_count' "$RULES_FILE" && echo 0 || echo 1)"
check "컨테이너 재시작 수 recording rule" "$(grep -q 'cluster:container:restarts_1h' "$RULES_FILE" && echo 0 || echo 1)"
check "ContainerCrashLoopBackOff 알림" "$(grep -q 'ContainerCrashLoopBackOff' "$RULES_FILE" && echo 0 || echo 1)"
check "ContainerHighRestartRate 알림" "$(grep -q 'ContainerHighRestartRate' "$RULES_FILE" && echo 0 || echo 1)"

# TC-N180.5: Grafana 대시보드
echo ""
echo "--- TC-N180.5: Grafana 대시보드 ---"
check "대시보드 파일 존재" "$(test -f "$DASHBOARD_FILE" && echo 0 || echo 1)"
check "대시보드 JSON 유효성" "$(python3 -c 'import json; json.load(open("'"$DASHBOARD_FILE"'"))' 2>/dev/null && echo 0 || echo 1)"
check "OOM Kill 패널" "$(grep -q 'oom_kills' "$DASHBOARD_FILE" && echo 0 || echo 1)"
check "CrashLoop 패널" "$(grep -q 'crashloop_count' "$DASHBOARD_FILE" && echo 0 || echo 1)"
check "이미지 풀 지연 패널" "$(grep -q 'pull_duration' "$DASHBOARD_FILE" && echo 0 || echo 1)"
check "런타임 건강 점수 패널" "$(grep -q 'health_score' "$DASHBOARD_FILE" && echo 0 || echo 1)"
check "containerd 작업 패널" "$(grep -q 'operations_rate' "$DASHBOARD_FILE" && echo 0 || echo 1)"
check "이미지 풀 성공률 패널" "$(grep -q 'pull_success_rate' "$DASHBOARD_FILE" && echo 0 || echo 1)"

# TC-N180.6: 이미지 레지스트리 접근성
echo ""
echo "--- TC-N180.6: 이미지 레지스트리 접근성 ---"
check "이미지 풀 오류 recording rule" "$(grep -q 'cluster:image:pull_errors_15m' "$RULES_FILE" && echo 0 || echo 1)"
check "이미지 풀 성공률 recording rule" "$(grep -q 'cluster:image:pull_success_rate' "$RULES_FILE" && echo 0 || echo 1)"
check "ImagePullErrors 알림" "$(grep -q 'ImagePullErrors' "$RULES_FILE" && echo 0 || echo 1)"
check "ImagePullErrorsCritical 알림" "$(grep -q 'ImagePullErrorsCritical' "$RULES_FILE" && echo 0 || echo 1)"

# 건강 점수 알림
echo ""
echo "--- 건강 점수 알림 ---"
check "ContainerRuntimeHealthLow 알림" "$(grep -q 'ContainerRuntimeHealthLow' "$RULES_FILE" && echo 0 || echo 1)"
check "ContainerRuntimeHealthCritical 알림" "$(grep -q 'ContainerRuntimeHealthCritical' "$RULES_FILE" && echo 0 || echo 1)"
check "런타임 건강 점수 recording rule" "$(grep -q 'cluster:container_runtime:health_score' "$RULES_FILE" && echo 0 || echo 1)"

# 보안 검증
echo ""
echo "--- 보안 검증 ---"
check "하드코딩 시크릿 없음 (rules)" "$(grep -qiE '(password|secret|token|api.?key)\s*[:=]' "$RULES_FILE" && echo 1 || echo 0)"
check "하드코딩 시크릿 없음 (dashboard)" "$(grep -qiE '(password|secret|token|api.?key)\s*[:=]' "$DASHBOARD_FILE" && echo 1 || echo 0)"

echo ""
echo "============================================"
echo "검증 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "============================================"
if [ "$FAIL" -gt 0 ]; then exit 1; fi
echo "모든 검증 통과"
