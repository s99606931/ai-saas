#!/bin/bash
# test-thanos-metrics.sh -- MTU-N102 Thanos 장기 메트릭 E2E 테스트
# Design Ref: MTU-N102 Design
# Plan SC: FR-N102.1~FR-N102.6
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

echo "=== MTU-N102: Thanos 장기 메트릭 E2E 테스트 ==="

# FR-N102.1: Thanos 설치
check "install.yaml 존재" \
    "$([ -f "$BASE/infra/thanos/install.yaml" ] && echo true || echo false)"

check "Query 컴포넌트 활성화" \
    "$(grep -q 'query:' "$BASE/infra/thanos/install.yaml" && echo true || echo false)"

check "Store Gateway 활성화" \
    "$(grep -q 'storegateway:' "$BASE/infra/thanos/install.yaml" && echo true || echo false)"

# FR-N102.2: MinIO 연동
check "objstore-config.yaml 존재" \
    "$([ -f "$BASE/infra/thanos/objstore-config.yaml" ] && echo true || echo false)"

check "S3 타입 설정" \
    "$(grep -q 'type: S3' "$BASE/infra/thanos/install.yaml" && echo true || echo false)"

check "MinIO 엔드포인트 설정" \
    "$(grep -q 'minio' "$BASE/infra/thanos/objstore-config.yaml" && echo true || echo false)"

# FR-N102.3: Compactor 다운샘플링
check "Compactor 활성화" \
    "$(grep -q 'compactor:' "$BASE/infra/thanos/install.yaml" && echo true || echo false)"

check "5m 해상도 보존 (30d)" \
    "$(grep -q 'retentionResolution5m: 30d' "$BASE/infra/thanos/install.yaml" && echo true || echo false)"

check "1h 해상도 보존 (365d)" \
    "$(grep -q 'retentionResolution1h: 365d' "$BASE/infra/thanos/install.yaml" && echo true || echo false)"

# FR-N102.4: Query Frontend
check "Query Frontend 활성화" \
    "$(grep -q 'queryFrontend:' "$BASE/infra/thanos/install.yaml" && echo true || echo false)"

check "캐시 설정 포함" \
    "$(grep -q 'IN-MEMORY' "$BASE/infra/thanos/install.yaml" && echo true || echo false)"

# 보안: 컨테이너 보안 컨텍스트
check "runAsNonRoot 설정" \
    "$(grep -q 'runAsNonRoot: true' "$BASE/infra/thanos/install.yaml" && echo true || echo false)"

check "readOnlyRootFilesystem" \
    "$(grep -q 'readOnlyRootFilesystem: true' "$BASE/infra/thanos/install.yaml" && echo true || echo false)"

# StorageClass 연동
check "Warm StorageClass 사용" \
    "$(grep -q 'sc-warm-standard' "$BASE/infra/thanos/install.yaml" && echo true || echo false)"

# 메트릭 모니터링
check "ServiceMonitor 활성화" \
    "$(grep -q 'serviceMonitor' "$BASE/infra/thanos/install.yaml" && echo true || echo false)"

echo ""
echo "=== 결과: $PASS/$TOTAL PASS, $FAIL FAIL ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
