#!/usr/bin/env bash
# Linkerd 서비스 메시 E2E 테스트
# Design Ref: DS-N114.6
# Plan SC: FR-N114.6
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
echo "Linkerd 서비스 메시 E2E 테스트"
echo "MTU-N114 | $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# T-N114.1: TrafficSplit YAML 유효성 + 가중치 합계 검증
echo ""
echo "--- T-N114.1: TrafficSplit 유효성 검증 ---"
for f in /data/ai-saas/infra/linkerd/traffic-split/*.yaml; do
  if [ -f "$f" ] && grep -q "kind: TrafficSplit" "$f"; then
    if python3 -c "import yaml; list(yaml.safe_load_all(open('$f')))" 2>/dev/null; then
      # 가중치 합계 검증 (1000이어야 함)
      WEIGHTS=$(python3 -c "
import yaml
docs = list(yaml.safe_load_all(open('$f')))
for doc in docs:
  if doc and doc.get('kind') == 'TrafficSplit':
    backends = doc.get('spec', {}).get('backends', [])
    total = sum(b.get('weight', 0) for b in backends)
    print(total)
" 2>/dev/null)
      ALL_VALID=true
      for w in $WEIGHTS; do
        if [ "$w" -eq 1000 ]; then
          :
        else
          ALL_VALID=false
        fi
      done
      if $ALL_VALID; then
        log_result "T-N114.1" "$(basename "$f") 가중치 합계 정상 (1000)" "PASS"
      else
        log_result "T-N114.1" "$(basename "$f") 가중치 합계 비정상" "FAIL"
      fi
    else
      log_result "T-N114.1" "$(basename "$f") YAML 파싱 실패" "FAIL"
    fi
  fi
done

# T-N114.2: RetryBudget 및 타임아웃 정책 검증
echo ""
echo "--- T-N114.2: RetryBudget 정책 검증 ---"
PROFILE="/data/ai-saas/infra/linkerd/retry-budget/enhanced-profiles.yaml"
if [ -f "$PROFILE" ]; then
  if python3 -c "import yaml; list(yaml.safe_load_all(open('$PROFILE')))" 2>/dev/null; then
    # retryBudget 존재 확인
    RB_COUNT=$(grep -c "retryBudget" "$PROFILE" || echo "0")
    if [ "$RB_COUNT" -ge 3 ]; then
      log_result "T-N114.2" "RetryBudget 정책 ${RB_COUNT}개 정의" "PASS"
    else
      log_result "T-N114.2" "RetryBudget 정책 부족 (${RB_COUNT}/3)" "FAIL"
    fi
    # 타임아웃 설정 확인
    TIMEOUT_COUNT=$(grep -c "timeout:" "$PROFILE" || echo "0")
    if [ "$TIMEOUT_COUNT" -ge 5 ]; then
      log_result "T-N114.2" "타임아웃 정책 ${TIMEOUT_COUNT}개 정의" "PASS"
    else
      log_result "T-N114.2" "타임아웃 정책 부족 (${TIMEOUT_COUNT}/5)" "FAIL"
    fi
  else
    log_result "T-N114.2" "ServiceProfile YAML 파싱 실패" "FAIL"
  fi
fi

# T-N114.3: ServerAuthorization meshTLS 확인
echo ""
echo "--- T-N114.3: ServerAuthorization meshTLS 검증 ---"
AUTH_DIR="/data/ai-saas/infra/linkerd/authorization"
SA_COUNT=$(grep -rl "kind: ServerAuthorization" "$AUTH_DIR"/*.yaml 2>/dev/null | wc -l)
MTLS_FILES=$(grep -rl "meshTLS" "$AUTH_DIR"/*.yaml 2>/dev/null | wc -l)
if [ "$SA_COUNT" -gt 0 ] && [ "$MTLS_FILES" -ge "$SA_COUNT" ]; then
  log_result "T-N114.3" "전체 ServerAuthorization에 meshTLS 적용 ($MTLS_FILES/$SA_COUNT)" "PASS"
else
  log_result "T-N114.3" "meshTLS 미적용 정책 존재 ($MTLS_FILES/$SA_COUNT)" "FAIL"
fi

# default-deny 정책 확인
if [ -f "$AUTH_DIR/default-deny.yaml" ]; then
  log_result "T-N114.3" "default-deny 정책 존재" "PASS"
else
  log_result "T-N114.3" "default-deny 정책 미존재" "FAIL"
fi

# T-N114.4: mTLS 검증 스크립트 존재 + 실행 가능
echo ""
echo "--- T-N114.4: mTLS 검증 스크립트 ---"
VERIFY_SCRIPT="/data/ai-saas/scripts/verify-mtls.sh"
if [ -f "$VERIFY_SCRIPT" ]; then
  log_result "T-N114.4" "mTLS 검증 스크립트 존재" "PASS"
  if [ -x "$VERIFY_SCRIPT" ] || chmod +x "$VERIFY_SCRIPT"; then
    # 실행 테스트 (linkerd 미설치 시 정적 분석 모드)
    if bash "$VERIFY_SCRIPT" saas-system 2>/dev/null; then
      log_result "T-N114.4" "mTLS 검증 스크립트 실행 성공" "PASS"
    else
      log_result "T-N114.4" "mTLS 검증 스크립트 실행 실패" "FAIL"
    fi
  fi
else
  log_result "T-N114.4" "mTLS 검증 스크립트 미존재" "FAIL"
fi

# T-N114.5: Grafana 대시보드 JSON 유효성
echo ""
echo "--- T-N114.5: 대시보드 JSON 유효성 ---"
DASHBOARD="/data/ai-saas/infra/monitoring/dashboards/linkerd-mesh-extended.json"
if [ -f "$DASHBOARD" ]; then
  if python3 -c "import json; d=json.load(open('$DASHBOARD')); print(len(d.get('panels',[])))" 2>/dev/null; then
    PANEL_COUNT=$(python3 -c "import json; d=json.load(open('$DASHBOARD')); print(len(d.get('panels',[])))")
    if [ "$PANEL_COUNT" -ge 5 ]; then
      log_result "T-N114.5" "대시보드 JSON 유효, 패널 ${PANEL_COUNT}개" "PASS"
    else
      log_result "T-N114.5" "대시보드 패널 부족 (${PANEL_COUNT}/5)" "FAIL"
    fi
  else
    log_result "T-N114.5" "대시보드 JSON 파싱 실패" "FAIL"
  fi
fi

# T-N114.6: 보안 레이블 일관성
echo ""
echo "--- T-N114.6: CSAP 보안 레이블 검증 ---"
CSAP_LABELS=0
for f in /data/ai-saas/infra/linkerd/authorization/service-mesh-policies.yaml \
         /data/ai-saas/infra/linkerd/traffic-split/api-gateway-canary.yaml; do
  if [ -f "$f" ] && grep -q "csap.compliance/control" "$f"; then
    CSAP_LABELS=$((CSAP_LABELS + 1))
  fi
done
if [ "$CSAP_LABELS" -ge 2 ]; then
  log_result "T-N114.6" "CSAP 컴플라이언스 레이블 적용 ($CSAP_LABELS 파일)" "PASS"
else
  log_result "T-N114.6" "CSAP 레이블 부족 ($CSAP_LABELS/2)" "FAIL"
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
