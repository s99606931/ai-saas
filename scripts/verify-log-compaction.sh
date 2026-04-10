#!/usr/bin/env bash
# Design Ref: MTU-N163
# Plan SC: FR-N163.6
# 로그 압축 정책 검증

set -euo pipefail

PASS=0; FAIL=0; WARN=0
check_pass() { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
check_fail() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }
check_warn() { echo "  [WARN] $1"; WARN=$((WARN + 1)); }

echo ""
echo "========================================"
echo " 지능형 로그 압축 정책 검증"
echo " 검증 시각: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "========================================"

echo ""
echo "--- 1. 매니페스트 파일 검증 ---"
for f in compaction-policy.yaml loki-storage-config.yaml prometheus-rules.yaml grafana-dashboard.json; do
  if [[ -f "/data/ai-saas/infra/log-compaction/${f}" ]]; then
    check_pass "${f} 존재"
  else
    check_fail "${f} 없음"
  fi
done

echo ""
echo "--- 2. 보존 정책 검증 ---"
if grep -q "365d" /data/ai-saas/infra/log-compaction/compaction-policy.yaml 2>/dev/null; then
  check_pass "감사 로그 365일 보존 정책 설정"
else
  check_fail "감사 로그 보존 정책 누락 (CSAP D-06)"
fi

if grep -q "180d" /data/ai-saas/infra/log-compaction/compaction-policy.yaml 2>/dev/null; then
  check_pass "보안 로그 180일 보존 정책 설정"
else
  check_warn "보안 로그 보존 정책 누락"
fi

echo ""
echo "--- 3. 압축 알고리즘 검증 ---"
for algo in gzip snappy zstd; do
  if grep -q "${algo}" /data/ai-saas/infra/log-compaction/compaction-policy.yaml 2>/dev/null; then
    check_pass "${algo} 압축 알고리즘 설정"
  else
    check_warn "${algo} 압축 미설정"
  fi
done

echo ""
echo "========================================"
echo " 결과: PASS=${PASS} FAIL=${FAIL} WARN=${WARN}"
echo "========================================"
[[ ${FAIL} -gt 0 ]] && exit 1 || exit 0
