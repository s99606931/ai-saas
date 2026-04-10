#!/bin/bash
# MTU-N199: PDB 준수 모니터링 E2E 테스트
# Design Ref: MTU-N199.design.md
# Plan SC: FR-N199.6
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
echo "MTU-N199: PDB 준수 모니터링 테스트"
echo "========================================"
echo ""

echo "[1/4] Recording Rules 파일 검증"
FILE="infra/monitoring/pdb-compliance-rules.yaml"
test -f "$FILE"; check "pdb-compliance-rules.yaml 파일 존재" $?
grep -q "pdb:total_count" "$FILE"; check "FR-N199.1: total_count recording rule" $?
grep -q "pdb:current_healthy" "$FILE"; check "FR-N199.1: current_healthy recording rule" $?
grep -q "pdb:desired_healthy" "$FILE"; check "FR-N199.1: desired_healthy recording rule" $?
grep -q "pdb:disruptions_allowed" "$FILE"; check "FR-N199.1: disruptions_allowed recording rule" $?
grep -q "pdb:disruptions_allowed_zero" "$FILE"; check "FR-N199.2: disruptions_allowed_zero recording rule" $?
grep -q "pdb:availability_ratio" "$FILE"; check "FR-N199.4: availability_ratio recording rule" $?
grep -q "pdb:violation_count" "$FILE"; check "FR-N199.4: violation_count recording rule" $?
grep -q "pdb:health_score" "$FILE"; check "health_score recording rule" $?
grep -q "pdb:expected_pods" "$FILE"; check "expected_pods recording rule" $?
grep -q "kube_poddisruptionbudget" "$FILE"; check "kube_poddisruptionbudget 메트릭 참조" $?
grep -q "mtu: N199" "$FILE"; check "MTU 라벨 존재" $?
echo ""

echo "[2/4] Alerting Rules 파일 검증"
FILE="infra/monitoring/pdb-compliance-alerts.yaml"
test -f "$FILE"; check "pdb-compliance-alerts.yaml 파일 존재" $?
grep -q "PDBDisruptionsAllowedZero" "$FILE"; check "FR-N199.2: PDBDisruptionsAllowedZero 알림" $?
grep -q "PDBCurrentBelowDesired" "$FILE"; check "FR-N199.4: PDBCurrentBelowDesired 알림" $?
grep -q "MultiplePDBsBlocked" "$FILE"; check "MultiplePDBsBlocked 알림" $?
grep -q "MultiplePDBViolations" "$FILE"; check "MultiplePDBViolations 알림" $?
grep -q "PDBHealthScoreLow" "$FILE"; check "PDBHealthScoreLow 알림" $?
grep -q "severity: critical" "$FILE"; check "critical 심각도 존재" $?
grep -q "severity: warning" "$FILE"; check "warning 심각도 존재" $?
grep -q "csap: D-10" "$FILE"; check "CSAP D-10 매핑" $?
grep -q "runbook_url" "$FILE"; check "Runbook URL 포함" $?
grep -q "mtu: N199" "$FILE"; check "MTU 라벨 존재" $?
echo ""

echo "[3/4] Grafana 대시보드 검증"
FILE="infra/monitoring/dashboards/pdb-compliance-dashboard.json"
test -f "$FILE"; check "pdb-compliance-dashboard.json 파일 존재" $?
python3 -c "import json; json.load(open('$FILE'))" 2>/dev/null; check "JSON 형식 유효성" $?
grep -q "pdb:health_score" "$FILE"; check "건강도 패널 존재" $?
grep -q "pdb:disruptions_allowed_zero" "$FILE"; check "중단 차단 패널 존재" $?
grep -q "pdb:violation_count" "$FILE"; check "위반 패널 존재" $?
grep -q "pdb:availability_ratio" "$FILE"; check "가용성 비율 패널 존재" $?
grep -q "pdb:disruptions_allowed" "$FILE"; check "허용 중단 패널 존재" $?
echo ""

echo "[4/4] YAML 유효성 검증"
for f in infra/monitoring/pdb-compliance-rules.yaml infra/monitoring/pdb-compliance-alerts.yaml; do
  python3 -c "import yaml; yaml.safe_load(open('$f'))" 2>/dev/null; check "$f YAML 유효성" $?
done
echo ""

echo "========================================"
echo "테스트 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "========================================"
if [ "$FAIL" -gt 0 ]; then exit 1; fi
