#!/bin/bash
# MTU-N207: GC 모니터링 E2E 테스트
# Plan SC: FR-N207.7 | CSAP: D-12
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="${SCRIPT_DIR}/../../infra/monitoring"
PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS + 1)); TOTAL=$((TOTAL + 1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL + 1)); TOTAL=$((TOTAL + 1)); echo "[FAIL] $1"; }

echo "=============================================="
echo "MTU-N207: GC 모니터링 E2E 테스트"
echo "=============================================="

RULES_FILE="${INFRA_DIR}/gc/gc-monitoring-rules.yaml"
ALERTS_FILE="${INFRA_DIR}/gc/gc-monitoring-alerts.yaml"
DASHBOARD_FILE="${INFRA_DIR}/dashboards/gc-monitoring-dashboard.json"

echo ""; echo "--- FR-N207.1 GC 레이턴시 recording rules ---"
for m in "gc_perf:gc_duration_p50" "gc_perf:gc_duration_p90" "gc_perf:gc_duration_p99"; do
  grep -q "$m" "$RULES_FILE" && pass "$m 존재" || fail "$m 누락"
done

echo ""; echo "--- FR-N207.2 GC 빈도 recording rules ---"
grep -q "gc_perf:gc_rate" "$RULES_FILE" && pass "gc_perf:gc_rate 존재" || fail "gc_perf:gc_rate 누락"

echo ""; echo "--- FR-N207.3 힙 메모리 recording rules ---"
for m in "gc_perf:heap_inuse_bytes" "gc_perf:heap_alloc_rate" "gc_perf:resident_memory_bytes" "gc_perf:goroutines_count"; do
  grep -q "$m" "$RULES_FILE" && pass "$m 존재" || fail "$m 누락"
done

echo ""; echo "--- FR-N207.4 GC 레이턴시 알림 ---"
for a in "GCDurationHigh" "GCRateHigh"; do
  grep -q "$a" "$ALERTS_FILE" && pass "$a 존재" || fail "$a 누락"
done

echo ""; echo "--- FR-N207.5 메모리 누수 알림 ---"
for a in "MemoryLeakSuspected" "HeapAllocRateHigh"; do
  grep -q "$a" "$ALERTS_FILE" && pass "$a 존재" || fail "$a 누락"
done

echo ""; echo "--- FR-N207.6 대시보드 ---"
[ -f "$DASHBOARD_FILE" ] && pass "대시보드 파일 존재" || fail "대시보드 미존재"
grep -q "gc_perf:gc_duration" "$DASHBOARD_FILE" && pass "GC 레이턴시 패널" || fail "GC 레이턴시 패널 누락"
grep -q "gc_perf:heap_inuse_bytes" "$DASHBOARD_FILE" && pass "힙 메모리 패널" || fail "힙 메모리 패널 누락"
grep -q "gc_perf:goroutines_count" "$DASHBOARD_FILE" && pass "고루틴 패널" || fail "고루틴 패널 누락"

echo ""; echo "--- 유효성 검사 ---"
python3 -c "import yaml; yaml.safe_load(open('$RULES_FILE'))" && pass "Rules YAML 유효" || fail "Rules YAML 무효"
python3 -c "import yaml; yaml.safe_load(open('$ALERTS_FILE'))" && pass "Alerts YAML 유효" || fail "Alerts YAML 무효"
python3 -c "import json; json.load(open('$DASHBOARD_FILE'))" && pass "대시보드 JSON 유효" || fail "대시보드 JSON 무효"
grep -q "csap.*D-10" "$ALERTS_FILE" && pass "CSAP D-10 참조" || fail "CSAP D-10 누락"

echo ""
echo "=============================================="
echo "MTU-N207 테스트 결과: ${PASS}/${TOTAL} 통과 (실패: ${FAIL})"
echo "=============================================="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
