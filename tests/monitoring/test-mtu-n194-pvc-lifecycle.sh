#!/bin/bash
# MTU-N194: PVC 라이프사이클 모니터링 E2E 테스트
# Design Ref: MTU-N194.design.md
# Plan SC: FR-N194.7
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
echo "MTU-N194: PVC 라이프사이클 모니터링 테스트"
echo "========================================"
echo ""

# --- Recording Rules 파일 검증 ---
echo "[1/4] Recording Rules 파일 검증"
FILE="infra/monitoring/pvc/pvc-lifecycle-rules.yaml"
test -f "$FILE"; check "pvc-lifecycle-rules.yaml 파일 존재" $?
grep -q "pvc_lifecycle:phase_count" "$FILE"; check "FR-N194.1: phase_count recording rule 존재" $?
grep -q "pvc_lifecycle:pending_duration_seconds" "$FILE"; check "FR-N194.5: pending_duration recording rule 존재" $?
grep -q "pvc_lifecycle:unattached_bound_count" "$FILE"; check "FR-N194.4: unattached_bound_count recording rule 존재" $?
grep -q "pvc_lifecycle:health_score" "$FILE"; check "health_score recording rule 존재" $?
grep -q "pvc_lifecycle:bound_count" "$FILE"; check "bound_count recording rule 존재" $?
grep -q "pvc_lifecycle:lost_count" "$FILE"; check "lost_count recording rule 존재" $?
grep -q "pvc_lifecycle:pending_count" "$FILE"; check "pending_count recording rule 존재" $?
grep -q "pvc_lifecycle:count_by_storageclass" "$FILE"; check "count_by_storageclass recording rule 존재" $?
grep -q "kube_persistentvolumeclaim_status_phase" "$FILE"; check "kube-state-metrics PVC 메트릭 참조" $?
grep -q "mtu: N194" "$FILE"; check "MTU 라벨 존재" $?
echo ""

# --- Alerting Rules 파일 검증 ---
echo "[2/4] Alerting Rules 파일 검증"
FILE="infra/monitoring/pvc/pvc-lifecycle-alerts.yaml"
test -f "$FILE"; check "pvc-lifecycle-alerts.yaml 파일 존재" $?
grep -q "PVCPendingTooLong" "$FILE"; check "FR-N194.2: PVCPendingTooLong 알림 존재" $?
grep -q "PVCPendingCritical" "$FILE"; check "FR-N194.2: PVCPendingCritical 알림 존재" $?
grep -q "PVCLostDetected" "$FILE"; check "FR-N194.3: PVCLostDetected 알림 존재" $?
grep -q "PVCUnattachedWarning" "$FILE"; check "FR-N194.4: PVCUnattachedWarning 알림 존재" $?
grep -q "MultiplePVCsPending" "$FILE"; check "MultiplePVCsPending 알림 존재" $?
grep -q "PVCHealthScoreLow" "$FILE"; check "PVCHealthScoreLow 알림 존재" $?
grep -q "severity: critical" "$FILE"; check "critical 심각도 라벨 존재" $?
grep -q "severity: warning" "$FILE"; check "warning 심각도 라벨 존재" $?
grep -q "csap: D-09" "$FILE"; check "CSAP D-09 매핑" $?
grep -q "csap: D-10" "$FILE"; check "CSAP D-10 매핑" $?
grep -q "runbook_url" "$FILE"; check "Runbook URL 포함" $?
grep -q "mtu: N194" "$FILE"; check "MTU 라벨 존재" $?
echo ""

# --- 대시보드 파일 검증 ---
echo "[3/4] Grafana 대시보드 검증"
FILE="infra/monitoring/dashboards/pvc-lifecycle-dashboard.json"
test -f "$FILE"; check "pvc-lifecycle-dashboard.json 파일 존재" $?
python3 -c "import json; json.load(open('$FILE'))" 2>/dev/null; check "JSON 형식 유효성" $?
grep -q "pvc_lifecycle:health_score" "$FILE"; check "건강도 점수 패널 존재" $?
grep -q "pvc_lifecycle:pending_count" "$FILE"; check "Pending 수량 패널 존재" $?
grep -q "pvc_lifecycle:lost_count" "$FILE"; check "Lost 수량 패널 존재" $?
grep -q "pvc_lifecycle:unattached_bound" "$FILE"; check "미사용 PVC 패널 존재" $?
grep -q "pvc_lifecycle:phase_count" "$FILE"; check "상태별 수량 추이 패널 존재" $?
grep -q "pvc_lifecycle:count_by_storageclass" "$FILE"; check "StorageClass 분포 패널 존재" $?
echo ""

# --- YAML 유효성 검증 ---
echo "[4/4] YAML 유효성 검증"
for f in infra/monitoring/pvc/pvc-lifecycle-rules.yaml infra/monitoring/pvc/pvc-lifecycle-alerts.yaml; do
  python3 -c "import yaml; yaml.safe_load(open('$f'))" 2>/dev/null; check "$f YAML 유효성" $?
done
echo ""

# --- 결과 요약 ---
echo "========================================"
echo "테스트 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "========================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
