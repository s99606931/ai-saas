#!/bin/bash
# MTU-N208: 디스크 I/O 포화도 E2E 테스트
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="${SCRIPT_DIR}/../../infra/monitoring"
PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS + 1)); TOTAL=$((TOTAL + 1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL + 1)); TOTAL=$((TOTAL + 1)); echo "[FAIL] $1"; }

echo "=============================================="
echo "MTU-N208: 디스크 I/O 포화도 E2E 테스트"
echo "=============================================="

RULES="${INFRA_DIR}/disk-io/disk-io-saturation-rules.yaml"
ALERTS="${INFRA_DIR}/disk-io/disk-io-saturation-alerts.yaml"
DASH="${INFRA_DIR}/dashboards/disk-io-saturation-dashboard.json"

echo ""; echo "--- FR-N208.1 포화도 recording rules ---"
for m in "disk_io:utilization_percent" "disk_io:io_weighted_time"; do
  grep -q "$m" "$RULES" && pass "$m" || fail "$m"
done

echo ""; echo "--- FR-N208.2 처리량 recording rules ---"
for m in "disk_io:read_throughput_bytes" "disk_io:write_throughput_bytes"; do
  grep -q "$m" "$RULES" && pass "$m" || fail "$m"
done

echo ""; echo "--- FR-N208.3 IOPS recording rules ---"
for m in "disk_io:read_iops" "disk_io:write_iops" "disk_io:avg_read_latency" "disk_io:avg_write_latency"; do
  grep -q "$m" "$RULES" && pass "$m" || fail "$m"
done

echo ""; echo "--- FR-N208.4 알림 ---"
for a in "DiskIOSaturationHigh" "DiskIOSaturationCritical" "DiskWriteLatencyHigh"; do
  grep -q "$a" "$ALERTS" && pass "$a" || fail "$a"
done

echo ""; echo "--- FR-N208.5 대시보드 ---"
[ -f "$DASH" ] && pass "파일 존재" || fail "파일 미존재"
grep -q "disk_io:utilization_percent" "$DASH" && pass "포화도 패널" || fail "포화도 패널 누락"
grep -q "disk_io:read_throughput_bytes" "$DASH" && pass "처리량 패널" || fail "처리량 패널 누락"
grep -q "disk_io:read_iops" "$DASH" && pass "IOPS 패널" || fail "IOPS 패널 누락"

echo ""; echo "--- 유효성 검사 ---"
python3 -c "import yaml; yaml.safe_load(open('$RULES'))" && pass "Rules YAML" || fail "Rules YAML"
python3 -c "import yaml; yaml.safe_load(open('$ALERTS'))" && pass "Alerts YAML" || fail "Alerts YAML"
python3 -c "import json; json.load(open('$DASH'))" && pass "Dashboard JSON" || fail "Dashboard JSON"
grep -q "csap.*D-10" "$ALERTS" && pass "CSAP D-10" || fail "CSAP D-10"

echo ""
echo "=============================================="
echo "MTU-N208 결과: ${PASS}/${TOTAL} 통과 (실패: ${FAIL})"
echo "=============================================="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
