#!/bin/bash
# MTU-N181: 애플리케이션 로그 패턴 이상 탐지 검증 스크립트
# Design Ref: DESIGN-N181
# Plan SC: FR-N181.1 ~ FR-N181.6
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
echo "MTU-N181: 로그 패턴 이상 탐지 검증"
echo "일시: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"
echo ""

LOKI_RULES="infra/monitoring/log-anomaly-rules.yaml"
PROM_RULES="infra/monitoring/log-metrics-rules.yaml"
DASHBOARD="infra/monitoring/dashboards/log-anomaly.json"

# TC-N181.1: 에러 로그 비율 모니터링
echo "--- TC-N181.1: 에러 로그 비율 ---"
check "Loki 알림 규칙 파일 존재" "$(test -f "$LOKI_RULES" && echo 0 || echo 1)"
check "LogErrorRateHigh 알림" "$(grep -q 'LogErrorRateHigh' "$LOKI_RULES" && echo 0 || echo 1)"
check "LogErrorRateCritical 알림" "$(grep -q 'LogErrorRateCritical' "$LOKI_RULES" && echo 0 || echo 1)"
check "LogWarnRateHigh 알림" "$(grep -q 'LogWarnRateHigh' "$LOKI_RULES" && echo 0 || echo 1)"
check "CSAP D-06 라벨" "$(grep -q 'csap_control: D-06' "$LOKI_RULES" && echo 0 || echo 1)"

# TC-N181.2: 로그 볼륨 이상 탐지
echo ""
echo "--- TC-N181.2: 로그 볼륨 이상 탐지 ---"
check "LogVolumeSurge 알림 (3배)" "$(grep -q 'LogVolumeSurge' "$LOKI_RULES" && echo 0 || echo 1)"
check "LogVolumeSurgeCritical 알림 (10배)" "$(grep -q 'LogVolumeSurgeCritical' "$LOKI_RULES" && echo 0 || echo 1)"
check "LogVolumeDropped 알림 (급감)" "$(grep -q 'LogVolumeDropped' "$LOKI_RULES" && echo 0 || echo 1)"

# TC-N181.3: 보안 로그 패턴 감지
echo ""
echo "--- TC-N181.3: 보안 로그 패턴 ---"
check "AuthenticationFailureBurst 알림" "$(grep -q 'AuthenticationFailureBurst' "$LOKI_RULES" && echo 0 || echo 1)"
check "AuthorizationViolation 알림" "$(grep -q 'AuthorizationViolation' "$LOKI_RULES" && echo 0 || echo 1)"
check "SqlInjectionSuspicion 알림" "$(grep -q 'SqlInjectionSuspicion' "$LOKI_RULES" && echo 0 || echo 1)"
check "XssSuspicion 알림" "$(grep -q 'XssSuspicion' "$LOKI_RULES" && echo 0 || echo 1)"
check "CSAP D-08 라벨" "$(grep -q 'csap_control: D-08' "$LOKI_RULES" && echo 0 || echo 1)"
check "CSAP D-12 라벨" "$(grep -q 'csap_control: D-12' "$LOKI_RULES" && echo 0 || echo 1)"

# TC-N181.4: Grafana 대시보드
echo ""
echo "--- TC-N181.4: Grafana 대시보드 ---"
check "대시보드 파일 존재" "$(test -f "$DASHBOARD" && echo 0 || echo 1)"
check "JSON 유효성" "$(python3 -c 'import json; json.load(open("'"$DASHBOARD"'"))' 2>/dev/null && echo 0 || echo 1)"
check "에러 로그 비율 패널" "$(grep -q 'error_volume' "$DASHBOARD" && echo 0 || echo 1)"
check "로그 볼륨 패널" "$(grep -q 'total_volume' "$DASHBOARD" && echo 0 || echo 1)"
check "보안 이벤트 패널" "$(grep -q 'authentication failed' "$DASHBOARD" && echo 0 || echo 1)"
check "스택트레이스 패널" "$(grep -q 'stacktrace' "$DASHBOARD" && echo 0 || echo 1)"
check "N2SF 등급별 로그 패널" "$(grep -q 'volume_by_grade' "$DASHBOARD" && echo 0 || echo 1)"
check "Loki 데이터소스 정의" "$(grep -q 'loki' "$DASHBOARD" && echo 0 || echo 1)"

# TC-N181.5: 스택트레이스/패닉 감지
echo ""
echo "--- TC-N181.5: 스택트레이스 감지 ---"
check "StackTraceDetected 알림" "$(grep -q 'StackTraceDetected' "$LOKI_RULES" && echo 0 || echo 1)"
check "StackTraceFrequent 알림" "$(grep -q 'StackTraceFrequent' "$LOKI_RULES" && echo 0 || echo 1)"

# TC-N181.6: N2SF 등급별 로그 볼륨
echo ""
echo "--- TC-N181.6: N2SF 등급별 로그 볼륨 ---"
check "PrometheusRule 파일 존재" "$(test -f "$PROM_RULES" && echo 0 || echo 1)"
check "kind: PrometheusRule" "$(grep -q 'kind: PrometheusRule' "$PROM_RULES" && echo 0 || echo 1)"
check "n2sf:log:volume_by_grade recording rule" "$(grep -q 'n2sf:log:volume_by_grade' "$PROM_RULES" && echo 0 || echo 1)"
check "n2sf:log:c_grade_volume recording rule" "$(grep -q 'n2sf:log:c_grade_volume' "$PROM_RULES" && echo 0 || echo 1)"
check "cluster:log:total_volume recording rule" "$(grep -q 'cluster:log:total_volume' "$PROM_RULES" && echo 0 || echo 1)"
check "namespace:log:volume recording rule" "$(grep -q 'namespace:log:volume' "$PROM_RULES" && echo 0 || echo 1)"
check "namespace:log:error_volume recording rule" "$(grep -q 'namespace:log:error_volume' "$PROM_RULES" && echo 0 || echo 1)"
check "N2sfGradeCLogVolumeAnomaly 알림" "$(grep -q 'N2sfGradeCLogVolumeAnomaly' "$PROM_RULES" && echo 0 || echo 1)"
check "ClusterLogVolumeHigh 알림" "$(grep -q 'ClusterLogVolumeHigh' "$PROM_RULES" && echo 0 || echo 1)"
check "N2SF 라벨" "$(grep -q 'n2sf_domain: log_analysis' "$PROM_RULES" && echo 0 || echo 1)"

# 보안 검증
echo ""
echo "--- 보안 검증 ---"
check "시크릿 없음 (loki rules)" "$(grep -qiE '(password|secret|token|api.?key)\s*[:=]' "$LOKI_RULES" && echo 1 || echo 0)"
check "시크릿 없음 (prom rules)" "$(grep -qiE '(password|secret|token|api.?key)\s*[:=]' "$PROM_RULES" && echo 1 || echo 0)"
check "시크릿 없음 (dashboard)" "$(grep -qiE '(password|secret|token|api.?key)\s*[:=]' "$DASHBOARD" && echo 1 || echo 0)"

echo ""
echo "============================================"
echo "검증 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "============================================"
if [ "$FAIL" -gt 0 ]; then exit 1; fi
echo "모든 검증 통과"
