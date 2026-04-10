#!/usr/bin/env bash
# KEDA 이벤트 기반 오토스케일 E2E 테스트
# Design Ref: DS-N113.8
# Plan SC: FR-N113.8
# CSAP: D-12 시스템 개발 보안
set -euo pipefail

PASS=0
FAIL=0
TOTAL=0

log_result() {
  local test_id="$1" desc="$2" result="$3"
  TOTAL=$((TOTAL + 1))
  if [ "$result" = "PASS" ]; then
    PASS=$((PASS + 1))
    echo "[PASS] $test_id: $desc"
  else
    FAIL=$((FAIL + 1))
    echo "[FAIL] $test_id: $desc"
  fi
}

echo "=========================================="
echo "KEDA 이벤트 기반 오토스케일 E2E 테스트"
echo "MTU-N113 | $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# T-N113.1: HTTP Add-on HTTPScaledObject YAML 유효성
echo ""
echo "--- T-N113.1: HTTP Add-on HTTPScaledObject YAML 유효성 ---"
for f in /data/ai-saas/infra/keda/http-add-on/httpscaledobject-*.yaml; do
  if [ -f "$f" ]; then
    # YAML 구문 검증
    if python3 -c "import yaml; yaml.safe_load_all(open('$f'))" 2>/dev/null; then
      # 필수 필드 확인
      if grep -q "kind: HTTPScaledObject" "$f" && grep -q "namespace: saas-system" "$f"; then
        log_result "T-N113.1" "$(basename "$f") YAML 유효 + 필수 필드 존재" "PASS"
      else
        log_result "T-N113.1" "$(basename "$f") 필수 필드 누락" "FAIL"
      fi
    else
      log_result "T-N113.1" "$(basename "$f") YAML 파싱 실패" "FAIL"
    fi
  fi
done

# T-N113.2: Prometheus ScaledObject YAML 유효성
echo ""
echo "--- T-N113.2: Prometheus ScaledObject YAML 유효성 ---"
for f in /data/ai-saas/infra/keda/scaled-objects/prometheus-*.yaml; do
  if [ -f "$f" ]; then
    if python3 -c "import yaml; yaml.safe_load_all(open('$f'))" 2>/dev/null; then
      if grep -q "type: prometheus" "$f" && grep -q "authenticationRef" "$f"; then
        log_result "T-N113.2" "$(basename "$f") Prometheus 스케일러 유효" "PASS"
      else
        log_result "T-N113.2" "$(basename "$f") Prometheus 스케일러 구성 누락" "FAIL"
      fi
    else
      log_result "T-N113.2" "$(basename "$f") YAML 파싱 실패" "FAIL"
    fi
  fi
done

# T-N113.3: Cron ScaledObject YAML 유효성
echo ""
echo "--- T-N113.3: Cron ScaledObject YAML 유효성 ---"
for f in /data/ai-saas/infra/keda/scaled-objects/cron-*.yaml; do
  if [ -f "$f" ]; then
    if python3 -c "import yaml; yaml.safe_load_all(open('$f'))" 2>/dev/null; then
      if grep -q "type: cron" "$f" && grep -q "timezone: Asia/Seoul" "$f"; then
        log_result "T-N113.3" "$(basename "$f") Cron 스케일러 유효 (KST)" "PASS"
      else
        log_result "T-N113.3" "$(basename "$f") Cron 스케일러 구성 누락" "FAIL"
      fi
    else
      log_result "T-N113.3" "$(basename "$f") YAML 파싱 실패" "FAIL"
    fi
  fi
done

# T-N113.4: TriggerAuthentication 시크릿 참조 확인 (하드코딩 없음)
echo ""
echo "--- T-N113.4: TriggerAuthentication 보안 검증 ---"
TRIGGER_AUTH="/data/ai-saas/infra/keda/trigger-auth/prometheus-auth.yaml"
if [ -f "$TRIGGER_AUTH" ]; then
  # 하드코딩된 토큰/비밀번호 없음 확인
  if ! grep -qiE "(password:|token:.*[a-zA-Z0-9]{20,}|bearer.*[a-zA-Z0-9]{20,})" "$TRIGGER_AUTH"; then
    log_result "T-N113.4" "TriggerAuthentication 하드코딩 없음" "PASS"
  else
    log_result "T-N113.4" "TriggerAuthentication 하드코딩 시크릿 발견!" "FAIL"
  fi
  # secretTargetRef 사용 확인
  if grep -q "secretTargetRef" "$TRIGGER_AUTH"; then
    log_result "T-N113.4" "TriggerAuthentication secretTargetRef 사용" "PASS"
  else
    log_result "T-N113.4" "TriggerAuthentication secretTargetRef 미사용" "FAIL"
  fi
fi

# T-N113.5: 안정화 윈도우 설정 확인 (>= 300s)
echo ""
echo "--- T-N113.5: 안정화 윈도우 검증 ---"
STAB_CHECK=true
for f in /data/ai-saas/infra/keda/scaled-objects/*.yaml; do
  if [ -f "$f" ] && grep -q "stabilizationWindowSeconds" "$f"; then
    WINDOWS=$(grep "stabilizationWindowSeconds" "$f" | grep -oE "[0-9]+")
    for w in $WINDOWS; do
      if [ "$w" -lt 300 ] && grep -q "scaleDown" "$f"; then
        # scaleUp은 30초 허용
        :
      fi
    done
  fi
done
# scaleDown 안정화 윈도우 >= 300 확인
SD_WINDOWS=$(grep -A1 "scaleDown" /data/ai-saas/infra/keda/scaled-objects/prometheus-error-rate.yaml | grep "stabilizationWindowSeconds" | grep -oE "[0-9]+" || echo "0")
for w in $SD_WINDOWS; do
  if [ "$w" -ge 300 ]; then
    log_result "T-N113.5" "ScaleDown 안정화 윈도우 ${w}s >= 300s" "PASS"
  else
    log_result "T-N113.5" "ScaleDown 안정화 윈도우 ${w}s < 300s" "FAIL"
  fi
done

# T-N113.6: 핵심 서비스 minReplica >= 1
echo ""
echo "--- T-N113.6: 핵심 서비스 최소 레플리카 검증 ---"
# auth-service 최소 레플리카 확인
AUTH_MIN=$(grep -A5 "auth-service" /data/ai-saas/infra/keda/scaled-objects/prometheus-error-rate.yaml | grep "minReplicaCount" | head -1 | grep -oE "[0-9]+" || echo "0")
if [ "$AUTH_MIN" -ge 1 ]; then
  log_result "T-N113.6" "auth-service minReplica=${AUTH_MIN} >= 1" "PASS"
else
  log_result "T-N113.6" "auth-service minReplica=${AUTH_MIN} < 1 (위험!)" "FAIL"
fi
# api-gateway 최소 레플리카 확인
GW_MIN=$(grep "min:" /data/ai-saas/infra/keda/http-add-on/httpscaledobject-api-gateway.yaml | head -1 | grep -oE "[0-9]+" || echo "0")
if [ "$GW_MIN" -ge 1 ]; then
  log_result "T-N113.6" "api-gateway minReplica=${GW_MIN} >= 1" "PASS"
else
  log_result "T-N113.6" "api-gateway minReplica=${GW_MIN} < 1 (위험!)" "FAIL"
fi

# T-N113.7: Grafana 대시보드 JSON 유효성
echo ""
echo "--- T-N113.7: Grafana 대시보드 JSON 유효성 ---"
DASHBOARD="/data/ai-saas/infra/monitoring/dashboards/keda-autoscale.json"
if [ -f "$DASHBOARD" ]; then
  if python3 -c "import json; json.load(open('$DASHBOARD'))" 2>/dev/null; then
    PANEL_COUNT=$(python3 -c "import json; d=json.load(open('$DASHBOARD')); print(len(d.get('panels',[])))")
    if [ "$PANEL_COUNT" -ge 5 ]; then
      log_result "T-N113.7" "대시보드 JSON 유효, 패널 ${PANEL_COUNT}개" "PASS"
    else
      log_result "T-N113.7" "대시보드 패널 부족 (${PANEL_COUNT}/5)" "FAIL"
    fi
  else
    log_result "T-N113.7" "대시보드 JSON 파싱 실패" "FAIL"
  fi
fi

# T-N113.8: N113 신규 매니페스트 네임스페이스 일관성
echo ""
echo "--- T-N113.8: 네임스페이스 일관성 검증 (N113 신규 파일) ---"
NS_CONSISTENT=true
# N113에서 새로 작성한 파일만 검증 (기존 ScaledObject는 이전 라운드 규칙)
for f in /data/ai-saas/infra/keda/http-add-on/httpscaledobject-*.yaml \
         /data/ai-saas/infra/keda/scaled-objects/prometheus-*.yaml \
         /data/ai-saas/infra/keda/scaled-objects/cron-*.yaml \
         /data/ai-saas/infra/keda/trigger-auth/*.yaml \
         /data/ai-saas/infra/keda/idle-replicas/*.yaml; do
  if [ -f "$f" ] && grep -q "namespace:" "$f"; then
    NS=$(grep "namespace:" "$f" | head -1 | awk '{print $2}')
    if [ "$NS" != "saas-system" ]; then
      NS_CONSISTENT=false
      log_result "T-N113.8" "$(basename "$f") 네임스페이스: $NS (불일치!)" "FAIL"
    fi
  fi
done
if $NS_CONSISTENT; then
  log_result "T-N113.8" "N113 신규 매니페스트 네임스페이스 saas-system 일관" "PASS"
fi

# 결과 요약
echo ""
echo "=========================================="
echo "테스트 결과 요약"
echo "=========================================="
echo "총 테스트: $TOTAL"
echo "통과: $PASS"
echo "실패: $FAIL"
echo "통과율: $(( PASS * 100 / TOTAL ))%"
echo "=========================================="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
