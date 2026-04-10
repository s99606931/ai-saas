#!/bin/bash
# test-cilium-zero-trust.sh — Cilium eBPF + Zero Trust E2E 테스트
# Design Ref: MTU-N93 Design
# Plan SC: FR-N93.6

set -euo pipefail

PASS=0
FAIL=0
TOTAL=0

run_test() {
    local name="$1"
    local cmd="$2"
    TOTAL=$((TOTAL + 1))
    echo -n "  [$TOTAL] $name ... "
    if eval "$cmd" >/dev/null 2>&1; then
        echo "PASS"
        PASS=$((PASS + 1))
    else
        echo "FAIL"
        FAIL=$((FAIL + 1))
    fi
}

echo "=========================================="
echo "  Cilium eBPF + Zero Trust E2E 테스트"
echo "=========================================="
echo ""

# 1. Cilium 설치 설정 존재
run_test "Cilium 설치 설정 존재" "[ -f infra/cilium/install.yaml ]"

# 2. Hubble 설정 존재
run_test "Hubble 관측 설정 존재" "[ -f infra/cilium/hubble.yaml ]"

# 3. L7 네트워크 정책 존재
run_test "L7 네트워크 정책 존재" "[ -f infra/cilium/network-policies/n2sf-l7-policies.yaml ]"

# 4. mTLS 설정 존재
run_test "mTLS Zero Trust 설정" "[ -f infra/cilium/mtls-config.yaml ]"

# 5. YAML 유효성 검증
run_test "설치 설정 YAML 유효" "python3 -c 'import yaml; yaml.safe_load(open(\"infra/cilium/install.yaml\"))'"
run_test "Hubble YAML 유효" "python3 -c 'import yaml; list(yaml.safe_load_all(open(\"infra/cilium/hubble.yaml\")))'"
run_test "정책 YAML 유효" "python3 -c 'import yaml; list(yaml.safe_load_all(open(\"infra/cilium/network-policies/n2sf-l7-policies.yaml\")))'"
run_test "mTLS YAML 유효" "python3 -c 'import yaml; list(yaml.safe_load_all(open(\"infra/cilium/mtls-config.yaml\")))'"

# 6. WireGuard 암호화 설정
run_test "WireGuard 노드 암호화" "grep -q 'wireguard' infra/cilium/install.yaml"

# 7. N2SF C등급 격리 정책
run_test "N2SF C등급 격리 정책" "grep -q 'grade-c' infra/cilium/network-policies/n2sf-l7-policies.yaml"

# 8. N2SF S등급 제한 정책
run_test "N2SF S등급 제한 정책" "grep -q 'grade-s' infra/cilium/network-policies/n2sf-l7-policies.yaml"

# 9. L7 HTTP 필터링
run_test "L7 HTTP 필터링 설정" "grep -q 'method: POST' infra/cilium/network-policies/n2sf-l7-policies.yaml"

# 10. SPIFFE 아이덴티티
run_test "SPIFFE Trust Domain 설정" "grep -q 'spiffe-trust-domain' infra/cilium/mtls-config.yaml"

# 11. Prometheus 메트릭 연동
run_test "Prometheus 메트릭 설정" "grep -q 'prometheus' infra/cilium/install.yaml"

# 12. Hubble UI 활성화
run_test "Hubble UI 활성화" "grep -q 'hubble-ui' infra/cilium/hubble.yaml"

echo ""
echo "=========================================="
echo "  결과: $PASS/$TOTAL PASS, $FAIL FAIL"
echo "=========================================="

if [ "$FAIL" -eq 0 ]; then
    echo "  판정: ALL PASS"
    exit 0
else
    echo "  판정: $FAIL건 실패"
    exit 1
fi
