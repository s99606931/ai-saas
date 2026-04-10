#!/bin/bash
# MTU-N182: Ingress/Gateway API 트래픽 모니터링 검증 스크립트
# Design Ref: DESIGN-N182
# Plan SC: FR-N182.1 ~ FR-N182.6
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
echo "MTU-N182: Ingress 트래픽 모니터링 검증"
echo "일시: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"
echo ""

RULES_FILE="infra/monitoring/ingress-traffic-rules.yaml"
DASHBOARD_FILE="infra/monitoring/dashboards/ingress-traffic.json"

# TC-N182.1: HTTP 상태 코드별 모니터링
echo "--- TC-N182.1: HTTP 상태 코드 모니터링 ---"
check "PrometheusRule 파일 존재" "$(test -f "$RULES_FILE" && echo 0 || echo 1)"
check "kind: PrometheusRule" "$(grep -q 'kind: PrometheusRule' "$RULES_FILE" && echo 0 || echo 1)"
check "requests_by_code_traefik recording rule" "$(grep -q 'ingress:http:requests_by_code_traefik' "$RULES_FILE" && echo 0 || echo 1)"
check "requests_by_code_nginx recording rule" "$(grep -q 'ingress:http:requests_by_code_nginx' "$RULES_FILE" && echo 0 || echo 1)"
check "error_rate_5xx_traefik recording rule" "$(grep -q 'ingress:http:error_rate_5xx_traefik' "$RULES_FILE" && echo 0 || echo 1)"
check "error_rate_5xx_nginx recording rule" "$(grep -q 'ingress:http:error_rate_5xx_nginx' "$RULES_FILE" && echo 0 || echo 1)"
check "error_rate_4xx recording rule" "$(grep -q 'ingress:http:error_rate_4xx' "$RULES_FILE" && echo 0 || echo 1)"
check "IngressHighErrorRate5xx 알림" "$(grep -q 'IngressHighErrorRate5xx' "$RULES_FILE" && echo 0 || echo 1)"
check "IngressCriticalErrorRate5xx 알림" "$(grep -q 'IngressCriticalErrorRate5xx' "$RULES_FILE" && echo 0 || echo 1)"
check "IngressHigh4xxRate 알림" "$(grep -q 'IngressHigh4xxRate' "$RULES_FILE" && echo 0 || echo 1)"
check "CSAP D-13 라벨" "$(grep -q 'csap-control: D-13' "$RULES_FILE" && echo 0 || echo 1)"

# TC-N182.2: 레이턴시 모니터링
echo ""
echo "--- TC-N182.2: 레이턴시 모니터링 ---"
check "latency_p50_traefik recording rule" "$(grep -q 'ingress:http:latency_p50_traefik' "$RULES_FILE" && echo 0 || echo 1)"
check "latency_p90_traefik recording rule" "$(grep -q 'ingress:http:latency_p90_traefik' "$RULES_FILE" && echo 0 || echo 1)"
check "latency_p99_traefik recording rule" "$(grep -q 'ingress:http:latency_p99_traefik' "$RULES_FILE" && echo 0 || echo 1)"
check "latency_p99_nginx recording rule" "$(grep -q 'ingress:http:latency_p99_nginx' "$RULES_FILE" && echo 0 || echo 1)"
check "IngressHighLatencyP99 알림" "$(grep -q 'IngressHighLatencyP99' "$RULES_FILE" && echo 0 || echo 1)"
check "IngressCriticalLatencyP99 알림" "$(grep -q 'IngressCriticalLatencyP99' "$RULES_FILE" && echo 0 || echo 1)"

# TC-N182.3: RPS 모니터링
echo ""
echo "--- TC-N182.3: RPS 모니터링 ---"
check "total_rps_traefik recording rule" "$(grep -q 'ingress:http:total_rps_traefik' "$RULES_FILE" && echo 0 || echo 1)"
check "total_rps_nginx recording rule" "$(grep -q 'ingress:http:total_rps_nginx' "$RULES_FILE" && echo 0 || echo 1)"
check "rps_by_entrypoint recording rule" "$(grep -q 'ingress:http:rps_by_entrypoint' "$RULES_FILE" && echo 0 || echo 1)"

# TC-N182.4: Grafana 대시보드
echo ""
echo "--- TC-N182.4: Grafana 대시보드 ---"
check "대시보드 파일 존재" "$(test -f "$DASHBOARD_FILE" && echo 0 || echo 1)"
check "JSON 유효성" "$(python3 -c 'import json; json.load(open("'"$DASHBOARD_FILE"'"))' 2>/dev/null && echo 0 || echo 1)"
check "RPS 패널" "$(grep -q 'total_rps' "$DASHBOARD_FILE" && echo 0 || echo 1)"
check "5xx 에러율 패널" "$(grep -q 'error_rate_5xx' "$DASHBOARD_FILE" && echo 0 || echo 1)"
check "레이턴시 패널" "$(grep -q 'latency_p99' "$DASHBOARD_FILE" && echo 0 || echo 1)"
check "TLS 인증서 패널" "$(grep -q 'cert_days_remaining' "$DASHBOARD_FILE" && echo 0 || echo 1)"
check "상태 코드별 RPS 패널" "$(grep -q 'requests_by_code' "$DASHBOARD_FILE" && echo 0 || echo 1)"
check "건강 점수 패널" "$(grep -q 'health_score' "$DASHBOARD_FILE" && echo 0 || echo 1)"
check "요청 크기 패널" "$(grep -q 'request_size_avg' "$DASHBOARD_FILE" && echo 0 || echo 1)"
check "Entrypoint RPS 패널" "$(grep -q 'rps_by_entrypoint' "$DASHBOARD_FILE" && echo 0 || echo 1)"

# TC-N182.5: 비정상 트래픽 탐지
echo ""
echo "--- TC-N182.5: 비정상 트래픽 탐지 ---"
check "IngressTrafficSpike 알림" "$(grep -q 'IngressTrafficSpike' "$RULES_FILE" && echo 0 || echo 1)"
check "IngressTrafficDrop 알림" "$(grep -q 'IngressTrafficDrop' "$RULES_FILE" && echo 0 || echo 1)"
check "IngressLargeRequestSize 알림" "$(grep -q 'IngressLargeRequestSize' "$RULES_FILE" && echo 0 || echo 1)"
check "request_size_avg recording rule" "$(grep -q 'ingress:http:request_size_avg' "$RULES_FILE" && echo 0 || echo 1)"
check "response_size_avg recording rule" "$(grep -q 'ingress:http:response_size_avg' "$RULES_FILE" && echo 0 || echo 1)"
check "CSAP D-08 라벨" "$(grep -q 'csap_control: D-08' "$RULES_FILE" && echo 0 || echo 1)"

# TC-N182.6: TLS 인증서 관리
echo ""
echo "--- TC-N182.6: TLS 인증서 관리 ---"
check "cert_days_remaining recording rule" "$(grep -q 'ingress:tls:cert_days_remaining' "$RULES_FILE" && echo 0 || echo 1)"
check "TlsCertExpiring30Days 알림" "$(grep -q 'TlsCertExpiring30Days' "$RULES_FILE" && echo 0 || echo 1)"
check "TlsCertExpiring7Days 알림" "$(grep -q 'TlsCertExpiring7Days' "$RULES_FILE" && echo 0 || echo 1)"
check "CSAP D-09 라벨" "$(grep -q 'csap_control: D-09' "$RULES_FILE" && echo 0 || echo 1)"

# 건강 점수 알림
echo ""
echo "--- 건강 점수 알림 ---"
check "IngressTrafficHealthLow 알림" "$(grep -q 'IngressTrafficHealthLow' "$RULES_FILE" && echo 0 || echo 1)"
check "IngressTrafficHealthCritical 알림" "$(grep -q 'IngressTrafficHealthCritical' "$RULES_FILE" && echo 0 || echo 1)"
check "health_score recording rule" "$(grep -q 'ingress:traffic:health_score' "$RULES_FILE" && echo 0 || echo 1)"

# 보안 검증
echo ""
echo "--- 보안 검증 ---"
check "시크릿 없음 (rules)" "$(grep -qiE '(password|secret|token|api.?key)\s*[:=]' "$RULES_FILE" && echo 1 || echo 0)"
check "시크릿 없음 (dashboard)" "$(grep -qiE '(password|secret|token|api.?key)\s*[:=]' "$DASHBOARD_FILE" && echo 1 || echo 0)"

echo ""
echo "============================================"
echo "검증 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "============================================"
if [ "$FAIL" -gt 0 ]; then exit 1; fi
echo "모든 검증 통과"
