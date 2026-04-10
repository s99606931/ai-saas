#!/bin/bash
# MTU-N202: CoreDNS 성능 모니터링 E2E 테스트
set -euo pipefail
PASS=0; FAIL=0; TOTAL=0
check() { TOTAL=$((TOTAL+1)); if [ "$2" = "0" ]; then echo "  [PASS] $1"; PASS=$((PASS+1)); else echo "  [FAIL] $1"; FAIL=$((FAIL+1)); fi; }

echo "========================================"
echo "MTU-N202: CoreDNS 성능 모니터링 테스트"
echo "========================================"
echo ""

echo "[1/4] Recording Rules"
FILE="infra/monitoring/dns/coredns-performance-rules.yaml"
test -f "$FILE"; check "파일 존재" $?
grep -q "coredns_perf:latency_p50" "$FILE"; check "FR-N202.1: latency_p50" $?
grep -q "coredns_perf:latency_p90" "$FILE"; check "FR-N202.1: latency_p90" $?
grep -q "coredns_perf:latency_p99" "$FILE"; check "FR-N202.1: latency_p99" $?
grep -q "coredns_perf:response_rate_by_rcode" "$FILE"; check "FR-N202.2: response_rate_by_rcode" $?
grep -q "coredns_perf:servfail_rate" "$FILE"; check "FR-N202.2: servfail_rate" $?
grep -q "coredns_perf:nxdomain_rate" "$FILE"; check "FR-N202.2: nxdomain_rate" $?
grep -q "coredns_perf:request_rate" "$FILE"; check "request_rate" $?
grep -q "coredns_perf:cache_hit_ratio" "$FILE"; check "cache_hit_ratio" $?
grep -q "coredns_perf:cache_size" "$FILE"; check "cache_size" $?
grep -q "coredns_dns_request_duration_seconds" "$FILE"; check "coredns 메트릭 참조" $?
grep -q "mtu: N202" "$FILE"; check "MTU 라벨" $?
echo ""

echo "[2/4] Alerting Rules"
FILE="infra/monitoring/dns/coredns-performance-alerts.yaml"
test -f "$FILE"; check "파일 존재" $?
grep -q "CoreDNSLatencyHigh" "$FILE"; check "FR-N202.3: CoreDNSLatencyHigh" $?
grep -q "CoreDNSLatencyCritical" "$FILE"; check "FR-N202.3: CoreDNSLatencyCritical" $?
grep -q "CoreDNSServfailSpike" "$FILE"; check "FR-N202.4: CoreDNSServfailSpike" $?
grep -q "CoreDNSNxdomainHigh" "$FILE"; check "CoreDNSNxdomainHigh" $?
grep -q "CoreDNSCacheHitLow" "$FILE"; check "CoreDNSCacheHitLow" $?
grep -q "CoreDNSRequestRateSpike" "$FILE"; check "CoreDNSRequestRateSpike" $?
grep -q "severity: critical" "$FILE"; check "critical 심각도" $?
grep -q "severity: warning" "$FILE"; check "warning 심각도" $?
grep -q "csap: D-10" "$FILE"; check "CSAP D-10 매핑" $?
grep -q "runbook_url" "$FILE"; check "Runbook URL" $?
grep -q "mtu: N202" "$FILE"; check "MTU 라벨" $?
echo ""

echo "[3/4] Grafana 대시보드"
FILE="infra/monitoring/dashboards/coredns-performance-dashboard.json"
test -f "$FILE"; check "파일 존재" $?
python3 -c "import json; json.load(open('$FILE'))" 2>/dev/null; check "JSON 유효성" $?
grep -q "coredns_perf:latency_p99" "$FILE"; check "레이턴시 패널" $?
grep -q "coredns_perf:servfail_rate" "$FILE"; check "SERVFAIL 패널" $?
grep -q "coredns_perf:cache_hit_ratio" "$FILE"; check "캐시 히트율 패널" $?
grep -q "coredns_perf:response_rate_by_rcode" "$FILE"; check "응답코드 패널" $?
grep -q "coredns_perf:request_rate_by_type" "$FILE"; check "요청유형 패널" $?
echo ""

echo "[4/4] YAML 유효성"
for f in infra/monitoring/dns/coredns-performance-rules.yaml infra/monitoring/dns/coredns-performance-alerts.yaml; do
  python3 -c "import yaml; yaml.safe_load(open('$f'))" 2>/dev/null; check "$f YAML" $?
done
echo ""

echo "========================================"
echo "테스트 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "========================================"
if [ "$FAIL" -gt 0 ]; then exit 1; fi
