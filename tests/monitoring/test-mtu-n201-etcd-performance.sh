#!/bin/bash
# MTU-N201: etcd 성능 상세 모니터링 E2E 테스트
# Plan SC: FR-N201.6
set -euo pipefail
PASS=0; FAIL=0; TOTAL=0
check() { TOTAL=$((TOTAL+1)); if [ "$2" = "0" ]; then echo "  [PASS] $1"; PASS=$((PASS+1)); else echo "  [FAIL] $1"; FAIL=$((FAIL+1)); fi; }

echo "========================================"
echo "MTU-N201: etcd 성능 상세 모니터링 테스트"
echo "========================================"
echo ""

echo "[1/4] Recording Rules"
FILE="infra/monitoring/etcd/etcd-performance-rules.yaml"
test -f "$FILE"; check "파일 존재" $?
grep -q "etcd_perf:wal_fsync_p99" "$FILE"; check "FR-N201.1: wal_fsync_p99" $?
grep -q "etcd_perf:wal_fsync_p50" "$FILE"; check "FR-N201.1: wal_fsync_p50" $?
grep -q "etcd_perf:backend_commit_p99" "$FILE"; check "FR-N201.1: backend_commit_p99" $?
grep -q "etcd_perf:backend_commit_p50" "$FILE"; check "FR-N201.1: backend_commit_p50" $?
grep -q "etcd_perf:db_size_bytes" "$FILE"; check "FR-N201.2: db_size_bytes" $?
grep -q "etcd_perf:db_size_growth_rate_1h" "$FILE"; check "FR-N201.2: db_size_growth_rate" $?
grep -q "etcd_perf:db_fragmentation_percent" "$FILE"; check "db_fragmentation_percent" $?
grep -q "etcd_perf:key_count" "$FILE"; check "key_count" $?
grep -q "etcd_perf:watcher_count" "$FILE"; check "watcher_count" $?
grep -q "etcd_disk_wal_fsync" "$FILE"; check "etcd_disk_wal_fsync 메트릭 참조" $?
grep -q "mtu: N201" "$FILE"; check "MTU 라벨" $?
echo ""

echo "[2/4] Alerting Rules"
FILE="infra/monitoring/etcd/etcd-performance-alerts.yaml"
test -f "$FILE"; check "파일 존재" $?
grep -q "EtcdWALFsyncSlow" "$FILE"; check "FR-N201.3: EtcdWALFsyncSlow" $?
grep -q "EtcdBackendCommitSlow" "$FILE"; check "FR-N201.3: EtcdBackendCommitSlow" $?
grep -q "EtcdDBSizeLarge" "$FILE"; check "FR-N201.4: EtcdDBSizeLarge" $?
grep -q "EtcdDBSizeGrowing" "$FILE"; check "FR-N201.4: EtcdDBSizeGrowing" $?
grep -q "EtcdDBFragmentationHigh" "$FILE"; check "EtcdDBFragmentationHigh" $?
grep -q "EtcdWALFsyncCritical" "$FILE"; check "EtcdWALFsyncCritical" $?
grep -q "severity: critical" "$FILE"; check "critical 심각도" $?
grep -q "severity: warning" "$FILE"; check "warning 심각도" $?
grep -q "csap: D-10" "$FILE"; check "CSAP D-10 매핑" $?
grep -q "csap: D-09" "$FILE"; check "CSAP D-09 매핑" $?
grep -q "runbook_url" "$FILE"; check "Runbook URL" $?
grep -q "mtu: N201" "$FILE"; check "MTU 라벨" $?
echo ""

echo "[3/4] Grafana 대시보드"
FILE="infra/monitoring/dashboards/etcd-performance-dashboard.json"
test -f "$FILE"; check "파일 존재" $?
python3 -c "import json; json.load(open('$FILE'))" 2>/dev/null; check "JSON 유효성" $?
grep -q "etcd_perf:wal_fsync_p99" "$FILE"; check "WAL fsync 패널" $?
grep -q "etcd_perf:backend_commit_p99" "$FILE"; check "Backend commit 패널" $?
grep -q "etcd_perf:db_size_bytes" "$FILE"; check "DB 크기 패널" $?
grep -q "etcd_perf:db_fragmentation_percent" "$FILE"; check "단편화율 패널" $?
grep -q "etcd_perf:key_count" "$FILE"; check "키 수 패널" $?
echo ""

echo "[4/4] YAML 유효성"
for f in infra/monitoring/etcd/etcd-performance-rules.yaml infra/monitoring/etcd/etcd-performance-alerts.yaml; do
  python3 -c "import yaml; yaml.safe_load(open('$f'))" 2>/dev/null; check "$f YAML" $?
done
echo ""

echo "========================================"
echo "테스트 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "========================================"
if [ "$FAIL" -gt 0 ]; then exit 1; fi
