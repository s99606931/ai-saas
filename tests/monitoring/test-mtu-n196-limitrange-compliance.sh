#!/bin/bash
# MTU-N196: 리소스 LimitRange 준수 모니터링 E2E 테스트
# Design Ref: MTU-N196.design.md
# Plan SC: FR-N196.6
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
echo "MTU-N196: LimitRange 준수 모니터링 테스트"
echo "========================================"
echo ""

# --- Recording Rules ---
echo "[1/4] Recording Rules 파일 검증"
FILE="infra/monitoring/limitrange-compliance-rules.yaml"
test -f "$FILE"; check "limitrange-compliance-rules.yaml 파일 존재" $?
grep -q "limitrange:namespace_count" "$FILE"; check "FR-N196.1: namespace_count recording rule" $?
grep -q "limitrange:missing_namespaces_count" "$FILE"; check "FR-N196.1: missing_namespaces_count recording rule" $?
grep -q "limitrange:containers_without_requests" "$FILE"; check "FR-N196.3: containers_without_requests recording rule" $?
grep -q "limitrange:containers_without_limits" "$FILE"; check "FR-N196.3: containers_without_limits recording rule" $?
grep -q "limitrange:compliance_score" "$FILE"; check "compliance_score recording rule" $?
grep -q "limitrange:namespace_coverage_percent" "$FILE"; check "namespace_coverage_percent recording rule" $?
grep -q "limitrange:total_containers" "$FILE"; check "total_containers recording rule" $?
grep -q "limitrange:settings_by_type" "$FILE"; check "FR-N196.4: settings_by_type recording rule" $?
grep -q "limitrange:containers_without_requests_by_ns" "$FILE"; check "containers_without_requests_by_ns recording rule" $?
grep -q "limitrange:containers_without_limits_by_ns" "$FILE"; check "containers_without_limits_by_ns recording rule" $?
grep -q "kube_limitrange" "$FILE"; check "kube_limitrange 메트릭 참조" $?
grep -q "mtu: N196" "$FILE"; check "MTU 라벨 존재" $?
echo ""

# --- Alerting Rules ---
echo "[2/4] Alerting Rules 파일 검증"
FILE="infra/monitoring/limitrange-compliance-alerts.yaml"
test -f "$FILE"; check "limitrange-compliance-alerts.yaml 파일 존재" $?
grep -q "LimitRangeMissing" "$FILE"; check "FR-N196.2: LimitRangeMissing 알림" $?
grep -q "ContainerWithoutResourceRequests" "$FILE"; check "FR-N196.3: ContainerWithoutResourceRequests 알림" $?
grep -q "ContainerWithoutResourceLimits" "$FILE"; check "FR-N196.3: ContainerWithoutResourceLimits 알림" $?
grep -q "LimitRangeComplianceLow" "$FILE"; check "LimitRangeComplianceLow 알림" $?
grep -q "LimitRangeNamespaceCoverageLow" "$FILE"; check "LimitRangeNamespaceCoverageLow 알림" $?
grep -q "MassResourceMisconfiguration" "$FILE"; check "MassResourceMisconfiguration 알림" $?
grep -q "severity: critical" "$FILE"; check "critical 심각도 존재" $?
grep -q "severity: warning" "$FILE"; check "warning 심각도 존재" $?
grep -q "csap: D-08" "$FILE"; check "CSAP D-08 매핑" $?
grep -q "csap: D-10" "$FILE"; check "CSAP D-10 매핑" $?
grep -q "runbook_url" "$FILE"; check "Runbook URL 포함" $?
grep -q "mtu: N196" "$FILE"; check "MTU 라벨 존재" $?
echo ""

# --- 대시보드 ---
echo "[3/4] Grafana 대시보드 검증"
FILE="infra/monitoring/dashboards/limitrange-compliance-dashboard.json"
test -f "$FILE"; check "limitrange-compliance-dashboard.json 파일 존재" $?
python3 -c "import json; json.load(open('$FILE'))" 2>/dev/null; check "JSON 형식 유효성" $?
grep -q "limitrange:compliance_score" "$FILE"; check "준수 점수 패널 존재" $?
grep -q "limitrange:namespace_coverage_percent" "$FILE"; check "네임스페이스 적용률 패널 존재" $?
grep -q "limitrange:containers_without_requests" "$FILE"; check "요청 미설정 패널 존재" $?
grep -q "limitrange:containers_without_limits" "$FILE"; check "제한 미설정 패널 존재" $?
grep -q "limitrange:missing_namespaces_count" "$FILE"; check "미설정 NS 패널 존재" $?
grep -q "limitrange:settings_by_type" "$FILE"; check "설정 상세 테이블 존재" $?
echo ""

# --- YAML 유효성 ---
echo "[4/4] YAML 유효성 검증"
for f in infra/monitoring/limitrange-compliance-rules.yaml infra/monitoring/limitrange-compliance-alerts.yaml; do
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
