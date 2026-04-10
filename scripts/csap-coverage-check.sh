#!/bin/bash
# csap-coverage-check.sh — CSAP 79항목 커버리지 자동 검증
# Design Ref: MTU-N95 Design
# Plan SC: FR-N95.2
# CSAP: 전체 79항목

set -euo pipefail

echo "=========================================="
echo "  CSAP 79항목 커버리지 검증"
echo "=========================================="
echo ""

TOTAL=0
COVERED=0

check_domain() {
    local domain="$1"
    local count="$2"
    local desc="$3"
    local dir="$4"

    TOTAL=$((TOTAL + count))

    if [ -f "$dir" ] || [ -d "$dir" ]; then
        COVERED=$((COVERED + count))
        echo "  $domain ($desc): $count항목 - COVERED"
    else
        echo "  $domain ($desc): $count항목 - MISSING ($dir)"
    fi
}

echo "--- 관리적 통제 (21항목) ---"
check_domain "D-01" 6 "정보보호 정책" "docs/framework/02-csap/standard-grade/implementation-guide/D01-policy.md"
check_domain "D-02" 5 "정보보호 조직" "docs/framework/02-csap/standard-grade/implementation-guide/D02-org-security.md"
check_domain "D-03" 4 "인적 보안" "docs/framework/02-csap/standard-grade/implementation-guide/D03-personnel.md"
check_domain "D-04" 6 "자산 관리" "docs/framework/02-csap/standard-grade/implementation-guide/D04-asset-mgmt.md"

echo ""
echo "--- 운영적 통제 (13항목) ---"
check_domain "D-05" 4 "공급망 관리" "docs/framework/02-csap/standard-grade/implementation-guide/D05-supply-chain.md"
check_domain "D-06" 5 "침해사고 관리" "docs/framework/02-csap/standard-grade/implementation-guide/D06-incident.md"
check_domain "D-07" 4 "재해복구" "docs/framework/02-csap/standard-grade/implementation-guide/D07-disaster-recovery.md"

echo ""
echo "--- 기술적 통제 (45항목) ---"
check_domain "D-08" 12 "접근 통제" "docs/framework/02-csap/standard-grade/implementation-guide/D08-access-control.md"
check_domain "D-09" 4 "암호화" "docs/framework/02-csap/standard-grade/implementation-guide/D09-encryption.md"
check_domain "D-10" 8 "네트워크 보안" "docs/framework/02-csap/standard-grade/implementation-guide/D10-network-security.md"
check_domain "D-11" 7 "가상화 보안" "docs/framework/02-csap/standard-grade/implementation-guide/D11-virtualization-security.md"
check_domain "D-12" 10 "시스템 개발 보안" "docs/framework/02-csap/standard-grade/implementation-guide/D12-system-dev-security.md"
check_domain "D-13" 4 "공공기관 추가" "docs/framework/02-csap/standard-grade/implementation-guide/D13-public-agency-additional.md"

echo ""
echo "=========================================="
echo "  CSAP 커버리지: $COVERED / $TOTAL ($(( (COVERED * 100) / TOTAL ))%)"
echo "=========================================="

if [ "$COVERED" -ge 70 ]; then
    echo "  판정: PASS (79항목 중 $COVERED개 커버)"
    exit 0
else
    echo "  판정: FAIL ($((TOTAL - COVERED))항목 미커버)"
    exit 1
fi
