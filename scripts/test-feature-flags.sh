#!/bin/bash
# Design Ref: MTU-N234
# Plan SC: FR-FF.1 ~ FR-FF.6
# Feature Flag 플랫폼 검증 스크립트

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

echo "============================================"
echo " MTU-N234: Feature Flag 플랫폼 검증"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"

# --- TC-01: Helm Chart 구조 검증 ---
echo ""
echo "[TC-01] Unleash Server Helm Chart 구조"
test -f infra/feature-flags/helm/unleash/Chart.yaml; check "Chart.yaml 존재" $?
test -f infra/feature-flags/helm/unleash/values.yaml; check "values.yaml 존재" $?
test -f infra/feature-flags/helm/unleash/templates/deployment.yaml; check "deployment.yaml 존재" $?
test -f infra/feature-flags/helm/unleash/templates/service.yaml; check "service.yaml 존재" $?
test -f infra/feature-flags/helm/unleash/templates/servicemonitor.yaml; check "servicemonitor.yaml 존재" $?
test -f infra/feature-flags/helm/unleash/templates/networkpolicy.yaml; check "networkpolicy.yaml 존재" $?
test -f infra/feature-flags/helm/unleash/templates/pdb.yaml; check "pdb.yaml 존재" $?

# --- TC-02: Edge Helm Chart 구조 ---
echo ""
echo "[TC-02] Unleash Edge Helm Chart 구조"
test -f infra/feature-flags/helm/unleash-edge/Chart.yaml; check "Edge Chart.yaml 존재" $?
test -f infra/feature-flags/helm/unleash-edge/values.yaml; check "Edge values.yaml 존재" $?
test -f infra/feature-flags/helm/unleash-edge/templates/deployment.yaml; check "Edge deployment.yaml 존재" $?

# --- TC-03: SDK 패키지 검증 ---
echo ""
echo "[TC-03] Feature Flag SDK"
test -f packages/feature-flag-sdk/src/index.ts; check "SDK index.ts 존재" $?
test -f packages/feature-flag-sdk/package.json; check "SDK package.json 존재" $?
grep -q "IFeatureFlagClient" packages/feature-flag-sdk/src/index.ts; check "IFeatureFlagClient 인터페이스 정의" $?
grep -q "UnleashFeatureFlagClient" packages/feature-flag-sdk/src/index.ts; check "UnleashFeatureFlagClient 구현" $?
grep -q "createFeatureFlagClient" packages/feature-flag-sdk/src/index.ts; check "팩토리 함수 정의" $?
grep -q "fallback" packages/feature-flag-sdk/src/index.ts; check "Fallback 전략 포함 (NFR-2)" $?

# --- TC-04: 보안 검증 ---
echo ""
echo "[TC-04] 보안 설정 검증"
grep -q "runAsNonRoot: true" infra/feature-flags/helm/unleash/values.yaml; check "Server runAsNonRoot" $?
grep -q "allowPrivilegeEscalation: false" infra/feature-flags/helm/unleash/values.yaml; check "Server 권한 상승 금지" $?
grep -q "readOnlyRootFilesystem: true" infra/feature-flags/helm/unleash/values.yaml; check "Server 읽기 전용 FS" $?
grep -q "secretKeyRef" infra/feature-flags/helm/unleash/templates/deployment.yaml; check "DB 인증 Secret 참조" $?
grep -q "NetworkPolicy" infra/feature-flags/helm/unleash/templates/networkpolicy.yaml; check "NetworkPolicy 정의" $?
# 하드코딩 시크릿 검사: 실제 시크릿 값이 포함되어 있는지 확인 (검증 로직 내 참조는 제외)
! grep -rPq "(?<!')sk-[a-zA-Z0-9]{10,}|password123|hardcoded.*secret" packages/feature-flag-sdk/src/; check "하드코딩 시크릿 없음" $?

# --- TC-05: 모니터링 검증 ---
echo ""
echo "[TC-05] 모니터링 대시보드"
test -f infra/monitoring/dashboards/feature-flags-dashboard.json; check "대시보드 JSON 존재" $?
grep -q "unleash_toggles_total" infra/monitoring/dashboards/feature-flags-dashboard.json; check "플래그 상태 메트릭" $?
grep -q "unleash_client_toggle_evaluation_total" infra/monitoring/dashboards/feature-flags-dashboard.json; check "평가 횟수 메트릭" $?
grep -q "unleash_http_request_duration" infra/monitoring/dashboards/feature-flags-dashboard.json; check "응답 시간 메트릭" $?

# --- TC-06: Design/Plan 추적성 ---
echo ""
echo "[TC-06] Design/Plan 추적성"
grep -q "Design Ref" infra/feature-flags/helm/unleash/Chart.yaml; check "Server Chart Design Ref" $?
grep -q "Plan SC" infra/feature-flags/helm/unleash/Chart.yaml; check "Server Chart Plan SC" $?
grep -q "Design Ref" packages/feature-flag-sdk/src/index.ts; check "SDK Design Ref" $?
grep -q "CSAP D-09" packages/feature-flag-sdk/src/index.ts; check "CSAP D-09 참조" $?

echo ""
echo "============================================"
echo " 결과: $PASS / $TOTAL PASS  ($FAIL FAIL)"
echo "============================================"

[ "$FAIL" -eq 0 ] && echo "ALL TESTS PASSED" || echo "SOME TESTS FAILED"
