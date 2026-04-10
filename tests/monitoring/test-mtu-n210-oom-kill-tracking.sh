#!/bin/bash
# MTU-N210: OOM Kill 이벤트 추적 E2E 테스트
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="${SCRIPT_DIR}/../../infra/monitoring"
PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS + 1)); TOTAL=$((TOTAL + 1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL + 1)); TOTAL=$((TOTAL + 1)); echo "[FAIL] $1"; }

echo "=============================================="
echo "MTU-N210: OOM Kill 이벤트 추적 E2E 테스트"
echo "=============================================="

RULES="${INFRA_DIR}/oom/oom-kill-tracking-rules.yaml"
ALERTS="${INFRA_DIR}/oom/oom-kill-tracking-alerts.yaml"
DASH="${INFRA_DIR}/dashboards/oom-kill-tracking-dashboard.json"

echo ""; echo "--- FR-N210.1 OOM Kill 횟수 ---"
for m in "oom:kill_count_by_namespace" "oom:kill_count_by_workload"; do
  grep -q "$m" "$RULES" && pass "$m" || fail "$m"
done

echo ""; echo "--- FR-N210.2 반복 OOM Kill ---"
grep -q "oom:recurring_kills" "$RULES" && pass "oom:recurring_kills" || fail "oom:recurring_kills"

echo ""; echo "--- FR-N210.3 limit 대비 사용률 ---"
for m in "oom:memory_near_limit_ratio" "oom:containers_near_limit"; do
  grep -q "$m" "$RULES" && pass "$m" || fail "$m"
done

echo ""; echo "--- FR-N210.4 OOM Kill 알림 ---"
grep -q "OOMKillDetected" "$ALERTS" && pass "OOMKillDetected" || fail "OOMKillDetected"

echo ""; echo "--- FR-N210.5 반복 OOM Kill / 근접 알림 ---"
for a in "OOMKillRecurring" "MemoryNearLimit"; do
  grep -q "$a" "$ALERTS" && pass "$a" || fail "$a"
done

echo ""; echo "--- FR-N210.6 대시보드 ---"
[ -f "$DASH" ] && pass "파일 존재" || fail "파일 미존재"
grep -q "oom:kill_count_by_namespace" "$DASH" && pass "OOM Kill 횟수 패널" || fail "OOM Kill 횟수 패널"
grep -q "oom:recurring_kills" "$DASH" && pass "반복 OOM 패널" || fail "반복 OOM 패널"
grep -q "oom:memory_near_limit_ratio" "$DASH" && pass "limit 사용률 패널" || fail "limit 사용률 패널"
grep -q "oom:containers_near_limit" "$DASH" && pass "near-limit 컨테이너 패널" || fail "near-limit 컨테이너 패널"

echo ""; echo "--- 유효성 ---"
python3 -c "import yaml; yaml.safe_load(open('$RULES'))" && pass "Rules YAML" || fail "Rules YAML"
python3 -c "import yaml; yaml.safe_load(open('$ALERTS'))" && pass "Alerts YAML" || fail "Alerts YAML"
python3 -c "import json; json.load(open('$DASH'))" && pass "Dashboard JSON" || fail "Dashboard JSON"
grep -q "csap.*D-10" "$ALERTS" && pass "CSAP D-10" || fail "CSAP D-10"

echo ""
echo "=============================================="
echo "MTU-N210 결과: ${PASS}/${TOTAL} 통과 (실패: ${FAIL})"
echo "=============================================="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
