#!/usr/bin/env bash
# =============================================================================
# Grafana 대시보드 성능 최적화 검증 스크립트
# Design Ref: MTU-N90 Design §2
# Plan SC: FR-N90.1 ~ FR-N90.6
# =============================================================================
set -euo pipefail

PASS=0
FAIL=0
TOTAL=0

pass() { PASS=$((PASS + 1)); TOTAL=$((TOTAL + 1)); echo "  [PASS] $1"; }
fail() { FAIL=$((FAIL + 1)); TOTAL=$((TOTAL + 1)); echo "  [FAIL] $1"; }
section() { echo ""; echo "=== $1 ==="; }

# =============================================================================
# TEST 1: Recording Rules 파일 검증 (FR-N90.1)
# =============================================================================
section "TEST 1: Recording Rules 최적화 (FR-N90.1)"

RR="infra/monitoring/grafana-optimized-recording-rules.yaml"

if [ -f "$RR" ]; then
  pass "Recording Rules 파일 존재"
else
  fail "Recording Rules 파일 없음"
fi

if grep -q "kind: PrometheusRule" "$RR" 2>/dev/null; then
  pass "PrometheusRule 리소스 타입 올바름"
else
  fail "PrometheusRule 리소스 타입 오류"
fi

for rule in "cluster:cpu_usage:ratio" "cluster:memory_usage:ratio" "cluster:disk_usage:ratio" "namespace:cpu_usage:sum_rate5m" "namespace:memory_usage:sum_bytes" "service:availability:ratio24h" "service:latency_p99:seconds" "node:cpu_usage:ratio"; do
  if grep -q "$rule" "$RR" 2>/dev/null; then
    pass "Recording Rule '$rule' 정의됨"
  else
    fail "Recording Rule '$rule' 누락"
  fi
done

# 간격 확인
if grep -q "interval: 30s" "$RR" 2>/dev/null; then
  pass "Recording Rule 간격 30초 설정됨"
else
  fail "Recording Rule 간격 설정 오류"
fi

# Design Ref 주석
if grep -q "Design Ref:" "$RR" 2>/dev/null; then
  pass "Design Ref 주석 존재"
else
  fail "Design Ref 주석 누락"
fi

# CSAP 참조
if grep -q "csap.ref" "$RR" 2>/dev/null; then
  pass "CSAP 참조 어노테이션 존재"
else
  fail "CSAP 참조 어노테이션 누락"
fi

# =============================================================================
# TEST 2: Grafana 캐싱/성능 설정 검증 (FR-N90.2, FR-N90.5)
# =============================================================================
section "TEST 2: Grafana 성능 설정 (FR-N90.2, FR-N90.5)"

GF="infra/monitoring/kube-prometheus-stack/values.yaml"

if grep -q "dataproxy:" "$GF" 2>/dev/null; then
  pass "Grafana dataproxy 설정 존재"
else
  fail "Grafana dataproxy 설정 누락"
fi

if grep -q "max_conns_per_host:" "$GF" 2>/dev/null; then
  pass "동시 연결 제한 설정됨"
else
  fail "동시 연결 제한 미설정"
fi

if grep -q "timeout: 30" "$GF" 2>/dev/null; then
  pass "쿼리 타임아웃 30초 설정됨"
else
  fail "쿼리 타임아웃 미설정"
fi

if grep -q "min_refresh_interval:" "$GF" 2>/dev/null; then
  pass "최소 갱신 주기 설정됨"
else
  fail "최소 갱신 주기 미설정"
fi

if grep -q "concurrent_render_request_limit:" "$GF" 2>/dev/null; then
  pass "동시 렌더링 제한 설정됨"
else
  fail "동시 렌더링 제한 미설정"
fi

# =============================================================================
# TEST 3: 최적화 대시보드 검증 (FR-N90.3, FR-N90.4)
# =============================================================================
section "TEST 3: 최적화 대시보드 (FR-N90.3, FR-N90.4)"

DB="infra/monitoring/dashboards/optimized-overview.json"

if [ -f "$DB" ]; then
  pass "최적화 대시보드 파일 존재"
else
  fail "최적화 대시보드 파일 없음"
fi

# Recording Rule 기반 쿼리 확인
for rule in "cluster:cpu_usage:ratio" "cluster:memory_usage:ratio" "namespace:cpu_usage:sum_rate5m" "service:availability:ratio24h"; do
  if grep -q "$rule" "$DB" 2>/dev/null; then
    pass "대시보드에 Recording Rule '$rule' 사용"
  else
    fail "대시보드에 Recording Rule '$rule' 미사용"
  fi
done

# 기본 시간 범위 확인 (1시간)
if grep -q '"from": "now-1h"' "$DB" 2>/dev/null; then
  pass "기본 시간 범위 1시간 설정됨 (FR-N90.4)"
else
  fail "기본 시간 범위 설정 오류"
fi

# 갱신 주기 확인
if grep -q '"refresh": "30s"' "$DB" 2>/dev/null; then
  pass "갱신 주기 30초 설정됨"
else
  fail "갱신 주기 설정 오류"
fi

# 타임존 확인
if grep -q '"timezone": "Asia/Seoul"' "$DB" 2>/dev/null; then
  pass "타임존 Asia/Seoul 설정됨"
else
  fail "타임존 설정 오류"
fi

# JSON 유효성 확인
if python3 -c "import json; json.load(open('$DB'))" 2>/dev/null; then
  pass "대시보드 JSON 유효성 통과"
else
  fail "대시보드 JSON 파싱 오류"
fi

# =============================================================================
# TEST 4: 성능 최적화 가이드 검증 (FR-N90.6)
# =============================================================================
section "TEST 4: 성능 최적화 가이드 (FR-N90.6)"

GUIDE="docs/operations/grafana-performance-guide.md"

if [ -f "$GUIDE" ]; then
  pass "성능 최적화 가이드 파일 존재"
else
  fail "성능 최적화 가이드 파일 없음"
fi

for keyword in "Recording Rules" "쿼리 최적화" "트러블슈팅" "변수 쿼리"; do
  if grep -q "$keyword" "$GUIDE" 2>/dev/null; then
    pass "가이드에 '$keyword' 섹션 존재"
  else
    fail "가이드에 '$keyword' 섹션 누락"
  fi
done

# =============================================================================
# 결과 요약
# =============================================================================
echo ""
echo "============================================"
echo "  MTU-N90 Grafana 성능 최적화 검증 결과"
echo "============================================"
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo "  TOTAL: $TOTAL"
echo "  RATE: $(( PASS * 100 / TOTAL ))%"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
