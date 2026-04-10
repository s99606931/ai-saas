#!/usr/bin/env bash
# =============================================================================
# VictoriaMetrics 장기 메트릭 저장소 검증 스크립트
# Design Ref: MTU-N89 Design §2
# Plan SC: FR-N89.1 ~ FR-N89.7
# CSAP: D-06(1년 보존), D-08(접근통제)
#
# 사용법: bash scripts/test-victoriametrics.sh
# =============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# 테스트 유틸리티
# ---------------------------------------------------------------------------
PASS=0
FAIL=0
TOTAL=0

pass() {
  PASS=$((PASS + 1))
  TOTAL=$((TOTAL + 1))
  echo "  [PASS] $1"
}

fail() {
  FAIL=$((FAIL + 1))
  TOTAL=$((TOTAL + 1))
  echo "  [FAIL] $1"
}

section() {
  echo ""
  echo "=== $1 ==="
}

# =============================================================================
# TEST 1: VictoriaMetrics Helm values 구조 검증 (FR-N89.1)
# =============================================================================
section "TEST 1: VictoriaMetrics Helm values 구조 검증 (FR-N89.1)"

VM_VALUES="infra/monitoring/victoriametrics/values.yaml"

if [ -f "$VM_VALUES" ]; then
  pass "VictoriaMetrics values.yaml 파일 존재"
else
  fail "VictoriaMetrics values.yaml 파일 없음"
fi

# 필수 섹션 확인
for key in "server:" "persistentVolume:" "resources:" "retentionPeriod:" "extraArgs:" "securityContext:" "serviceMonitor:"; do
  if grep -q "$key" "$VM_VALUES" 2>/dev/null; then
    pass "values.yaml에 $key 섹션 존재"
  else
    fail "values.yaml에 $key 섹션 누락"
  fi
done

# StorageClass 확인 (k3s 기본)
if grep -q "storageClass: local-path" "$VM_VALUES" 2>/dev/null; then
  pass "k3s 기본 StorageClass (local-path) 설정됨"
else
  fail "StorageClass 설정 누락"
fi

# 이미지 태그 확인
if grep -q "tag:" "$VM_VALUES" 2>/dev/null; then
  pass "이미지 태그 명시적으로 지정됨"
else
  fail "이미지 태그 누락 (latest 사용 금지)"
fi

# =============================================================================
# TEST 2: Prometheus remote_write 연동 구성 검증 (FR-N89.2)
# =============================================================================
section "TEST 2: Prometheus remote_write 연동 구성 검증 (FR-N89.2)"

PROM_VALUES="infra/monitoring/kube-prometheus-stack/values.yaml"

if grep -q "remoteWrite:" "$PROM_VALUES" 2>/dev/null; then
  pass "Prometheus values.yaml에 remoteWrite 섹션 존재"
else
  fail "Prometheus values.yaml에 remoteWrite 섹션 누락"
fi

if grep -q "victoria-metrics-server.monitoring.svc:8428" "$PROM_VALUES" 2>/dev/null; then
  pass "VictoriaMetrics remote_write URL 설정됨"
else
  fail "VictoriaMetrics remote_write URL 누락"
fi

if grep -q "/api/v1/write" "$PROM_VALUES" 2>/dev/null; then
  pass "remote_write API 경로 올바름 (/api/v1/write)"
else
  fail "remote_write API 경로 오류"
fi

if grep -q "queueConfig:" "$PROM_VALUES" 2>/dev/null; then
  pass "remote_write queueConfig 설정됨"
else
  fail "remote_write queueConfig 누락"
fi

if grep -q "maxSamplesPerSend:" "$PROM_VALUES" 2>/dev/null; then
  pass "remote_write 배치 크기 설정됨"
else
  fail "remote_write 배치 크기 누락"
fi

# =============================================================================
# TEST 3: 데이터 보존 정책 검증 (FR-N89.3)
# =============================================================================
section "TEST 3: 데이터 보존 정책 검증 (FR-N89.3)"

# VictoriaMetrics 365일(12개월) 보존
if grep -q 'retentionPeriod: "12"' "$VM_VALUES" 2>/dev/null; then
  pass "VictoriaMetrics 12개월(365일) 보존 설정됨 (CSAP D-06)"
else
  fail "VictoriaMetrics 보존 기간 설정 오류 (12개월 필요)"
fi

# Prometheus 30일 보존 (Hot 계층)
if grep -q "retention: 30d" "$PROM_VALUES" 2>/dev/null; then
  pass "Prometheus 30일 보존 설정됨 (Hot 계층)"
else
  fail "Prometheus 보존 기간 설정 오류"
fi

# 저장소 크기 확인
if grep -q "size: 50Gi" "$VM_VALUES" 2>/dev/null; then
  pass "VictoriaMetrics PV 50Gi 설정됨"
else
  fail "VictoriaMetrics PV 크기 설정 오류"
fi

# =============================================================================
# TEST 4: Grafana 데이터소스 검증 (FR-N89.4)
# =============================================================================
section "TEST 4: Grafana 데이터소스 검증 (FR-N89.4)"

GF_DS="infra/monitoring/victoriametrics/grafana-datasource.yaml"

if [ -f "$GF_DS" ]; then
  pass "Grafana VictoriaMetrics 데이터소스 파일 존재"
else
  fail "Grafana 데이터소스 파일 없음"
fi

if grep -q "grafana_datasource" "$GF_DS" 2>/dev/null; then
  pass "grafana_datasource 레이블 설정됨 (sidecar 자동 감지)"
else
  fail "grafana_datasource 레이블 누락"
fi

if grep -q "victoria-metrics-server.monitoring.svc:8428" "$GF_DS" 2>/dev/null; then
  pass "데이터소스 URL 올바름"
else
  fail "데이터소스 URL 오류"
fi

if grep -q 'isDefault: false' "$GF_DS" 2>/dev/null; then
  pass "VictoriaMetrics가 기본 데이터소스가 아님 (Prometheus가 기본)"
else
  fail "isDefault 설정 오류"
fi

if grep -q "httpMethod: POST" "$GF_DS" 2>/dev/null; then
  pass "POST 방식 쿼리 설정됨 (긴 쿼리 URL 방지)"
else
  fail "POST 방식 쿼리 미설정"
fi

# =============================================================================
# TEST 5: NetworkPolicy 접근통제 검증 (FR-N89.5)
# =============================================================================
section "TEST 5: NetworkPolicy 접근통제 검증 (FR-N89.5)"

NP="infra/monitoring/victoriametrics/network-policy.yaml"

if [ -f "$NP" ]; then
  pass "NetworkPolicy 파일 존재"
else
  fail "NetworkPolicy 파일 없음"
fi

if grep -q "kind: NetworkPolicy" "$NP" 2>/dev/null; then
  pass "NetworkPolicy 리소스 타입 올바름"
else
  fail "NetworkPolicy 리소스 타입 오류"
fi

if grep -q "namespace: monitoring" "$NP" 2>/dev/null; then
  pass "monitoring 네임스페이스 설정됨"
else
  fail "네임스페이스 설정 오류"
fi

if grep -q "Ingress" "$NP" 2>/dev/null; then
  pass "Ingress 정책 유형 설정됨"
else
  fail "Ingress 정책 유형 누락"
fi

# Prometheus 접근 허용 확인
if grep -q "prometheus" "$NP" 2>/dev/null; then
  pass "Prometheus 접근 허용 규칙 존재"
else
  fail "Prometheus 접근 허용 규칙 누락"
fi

# Grafana 접근 허용 확인
if grep -q "grafana" "$NP" 2>/dev/null; then
  pass "Grafana 접근 허용 규칙 존재"
else
  fail "Grafana 접근 허용 규칙 누락"
fi

# 포트 8428 확인
if grep -q "8428" "$NP" 2>/dev/null; then
  pass "VictoriaMetrics 포트 8428 명시됨"
else
  fail "VictoriaMetrics 포트 명시 누락"
fi

# CSAP 어노테이션 확인
if grep -q "csap.ref/d08" "$NP" 2>/dev/null; then
  pass "CSAP D-08 어노테이션 존재"
else
  fail "CSAP D-08 어노테이션 누락"
fi

# =============================================================================
# TEST 6: 리소스 제한 검증 (FR-N89.6)
# =============================================================================
section "TEST 6: 리소스 제한 검증 (FR-N89.6)"

# CPU 제한
if grep -q "cpu: 500m" "$VM_VALUES" 2>/dev/null; then
  pass "VictoriaMetrics CPU limit 500m 설정됨"
else
  fail "VictoriaMetrics CPU limit 설정 오류"
fi

# Memory 제한
if grep -q "memory: 1Gi" "$VM_VALUES" 2>/dev/null; then
  pass "VictoriaMetrics Memory limit 1Gi 설정됨"
else
  fail "VictoriaMetrics Memory limit 설정 오류"
fi

# 보안 컨텍스트 확인
if grep -q "runAsNonRoot: true" "$VM_VALUES" 2>/dev/null; then
  pass "Pod 보안 컨텍스트: runAsNonRoot 설정됨"
else
  fail "runAsNonRoot 미설정 (보안 위반)"
fi

if grep -q "readOnlyRootFilesystem: true" "$VM_VALUES" 2>/dev/null; then
  pass "컨테이너 보안: readOnlyRootFilesystem 설정됨"
else
  fail "readOnlyRootFilesystem 미설정"
fi

if grep -q "allowPrivilegeEscalation: false" "$VM_VALUES" 2>/dev/null; then
  pass "컨테이너 보안: allowPrivilegeEscalation false"
else
  fail "allowPrivilegeEscalation 미설정"
fi

# memory.allowedPercent 확인 (OOM 방지)
if grep -q "memory.allowedPercent" "$VM_VALUES" 2>/dev/null; then
  pass "메모리 사용 비율 제한 설정됨 (OOM 방지)"
else
  fail "메모리 사용 비율 제한 누락"
fi

# =============================================================================
# TEST 7: 셋업 스크립트 통합 검증 (FR-N89.7)
# =============================================================================
section "TEST 7: Design 문서 참조 주석 검증 (FR-N89.7)"

# Design Ref 주석 확인
if grep -q "Design Ref:" "$VM_VALUES" 2>/dev/null; then
  pass "values.yaml에 Design Ref 주석 존재"
else
  fail "values.yaml에 Design Ref 주석 누락"
fi

if grep -q "Plan SC:" "$VM_VALUES" 2>/dev/null; then
  pass "values.yaml에 Plan SC 주석 존재"
else
  fail "values.yaml에 Plan SC 주석 누락"
fi

if grep -q "CSAP:" "$VM_VALUES" 2>/dev/null; then
  pass "values.yaml에 CSAP 참조 주석 존재"
else
  fail "values.yaml에 CSAP 참조 주석 누락"
fi

# Helm 설치 명령 확인
if grep -q "helm install" "$VM_VALUES" 2>/dev/null || grep -q "helm upgrade" "$VM_VALUES" 2>/dev/null; then
  pass "Helm 설치 명령 주석 존재"
else
  fail "Helm 설치 명령 주석 누락"
fi

# ServiceMonitor 확인
if grep -q "serviceMonitor:" "$VM_VALUES" 2>/dev/null; then
  pass "ServiceMonitor 설정됨 (자체 메트릭 수집)"
else
  fail "ServiceMonitor 미설정"
fi

# Deduplication 설정 확인
if grep -q "dedup.minScrapeInterval" "$VM_VALUES" 2>/dev/null; then
  pass "중복 제거 설정됨 (remote_write 재전송 대비)"
else
  fail "중복 제거 미설정"
fi

# writeRelabelConfigs 확인 (고카디널리티 메트릭 필터링)
if grep -q "writeRelabelConfigs:" "$PROM_VALUES" 2>/dev/null; then
  pass "remote_write relabel 설정으로 불필요 메트릭 필터링"
else
  fail "remote_write relabel 미설정"
fi

# =============================================================================
# 결과 요약
# =============================================================================
echo ""
echo "============================================"
echo "  MTU-N89 VictoriaMetrics 검증 결과"
echo "============================================"
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo "  TOTAL: $TOTAL"
echo "  RATE: $(( PASS * 100 / TOTAL ))%"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
