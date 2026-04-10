#!/bin/bash
# test-cilium-bandwidth.sh -- MTU-N98 Cilium 대역폭 관리 E2E 테스트
# Design Ref: MTU-N98 Design
# Plan SC: FR-N98.1~FR-N98.5
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0
BASE="/data/ai-saas"

check() {
    local name="$1"; local result="$2"
    TOTAL=$((TOTAL + 1))
    if [ "$result" = "true" ]; then
        PASS=$((PASS + 1)); echo "  [PASS] $name"
    else
        FAIL=$((FAIL + 1)); echo "  [FAIL] $name"
    fi
}

echo "=== MTU-N98: Cilium 대역폭 관리 E2E 테스트 ==="

# FR-N98.1: BandwidthManager 활성화
check "bandwidth-manager.yaml 존재" \
    "$([ -f "$BASE/infra/cilium/bandwidth-manager.yaml" ] && echo true || echo false)"

check "bandwidthManager 활성화" \
    "$(grep -q 'enabled: true' "$BASE/infra/cilium/bandwidth-manager.yaml" && echo true || echo false)"

check "BBR 활성화" \
    "$(grep -q 'bbr: true' "$BASE/infra/cilium/bandwidth-manager.yaml" && echo true || echo false)"

# FR-N98.2: EDT + BBR
check "bbr-tuning.yaml 존재" \
    "$([ -f "$BASE/infra/cilium/bbr-tuning.yaml" ] && echo true || echo false)"

check "sysctl BBR 설정 포함" \
    "$(grep -q 'tcp_congestion_control.*bbr' "$BASE/infra/cilium/bbr-tuning.yaml" && echo true || echo false)"

check "fq qdisc 설정 포함" \
    "$(grep -q 'default_qdisc.*fq' "$BASE/infra/cilium/bbr-tuning.yaml" && echo true || echo false)"

# FR-N98.3: 대역폭 제한 정책
check "bandwidth-limits.yaml 존재" \
    "$([ -f "$BASE/infra/cilium/network-policies/bandwidth-limits.yaml" ] && echo true || echo false)"

POLICY_COUNT=$(grep -c 'kind: CiliumNetworkPolicy' "$BASE/infra/cilium/network-policies/bandwidth-limits.yaml" || echo 0)
check "대역폭 정책 5개 ($POLICY_COUNT)" \
    "$([ "$POLICY_COUNT" -ge 5 ] && echo true || echo false)"

# N2SF 등급별 대역폭
check "C등급 대역폭 제한 포함" \
    "$(grep -q 'n2sf.grade.*C' "$BASE/infra/cilium/network-policies/bandwidth-limits.yaml" && echo true || echo false)"

check "S등급 대역폭 제한 포함" \
    "$(grep -q 'n2sf.grade.*S' "$BASE/infra/cilium/network-policies/bandwidth-limits.yaml" && echo true || echo false)"

# FR-N98.4: Hubble 메트릭 수집
check "Hubble 메트릭 활성화" \
    "$(grep -q 'hubble:' "$BASE/infra/cilium/bandwidth-manager.yaml" && echo true || echo false)"

check "HTTP 메트릭 수집" \
    "$(grep -q 'httpV2' "$BASE/infra/cilium/bandwidth-manager.yaml" && echo true || echo false)"

# 보안: kube-proxy 대체
check "kubeProxyReplacement 활성화" \
    "$(grep -q 'kubeProxyReplacement: true' "$BASE/infra/cilium/bandwidth-manager.yaml" && echo true || echo false)"

echo ""
echo "=== 결과: $PASS/$TOTAL PASS, $FAIL FAIL ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
