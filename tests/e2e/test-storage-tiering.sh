#!/bin/bash
# test-storage-tiering.sh -- MTU-N97 스토리지 계층화 E2E 테스트
# Design Ref: MTU-N97 Design
# Plan SC: FR-N97.1~FR-N97.5
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

echo "=== MTU-N97: 스토리지 계층화 E2E 테스트 ==="

# FR-N97.1: StorageClass 3단계 정의
check "Hot StorageClass 파일 존재" \
    "$([ -f "$BASE/infra/storage/storageclass-hot.yaml" ] && echo true || echo false)"

check "Warm StorageClass 파일 존재" \
    "$([ -f "$BASE/infra/storage/storageclass-warm.yaml" ] && echo true || echo false)"

check "Cold StorageClass 파일 존재" \
    "$([ -f "$BASE/infra/storage/storageclass-cold.yaml" ] && echo true || echo false)"

check "Hot tier 라벨 포함" \
    "$(grep -q 'tier: hot' "$BASE/infra/storage/storageclass-hot.yaml" && echo true || echo false)"

check "Warm tier 라벨 포함" \
    "$(grep -q 'tier: warm' "$BASE/infra/storage/storageclass-warm.yaml" && echo true || echo false)"

check "Cold tier 라벨 포함" \
    "$(grep -q 'tier: cold' "$BASE/infra/storage/storageclass-cold.yaml" && echo true || echo false)"

# FR-N97.2: MinIO ILM 규칙
check "ILM 규칙 파일 존재" \
    "$([ -f "$BASE/infra/storage/minio-ilm-rules.yaml" ] && echo true || echo false)"

ILM_RULES=$(grep -c 'ID.*hot-to-\|ID.*warm-to-\|ID.*expiration' "$BASE/infra/storage/minio-ilm-rules.yaml" || echo 0)
check "ILM 규칙 5개 이상 ($ILM_RULES)" \
    "$([ "$ILM_RULES" -ge 5 ] && echo true || echo false)"

# FR-N97.3: 데이터 이전 자동화
check "CronJob 파일 존재" \
    "$([ -f "$BASE/infra/storage/data-lifecycle-cronjob.yaml" ] && echo true || echo false)"

check "CronJob 스케줄 설정" \
    "$(grep -q 'schedule:' "$BASE/infra/storage/data-lifecycle-cronjob.yaml" && echo true || echo false)"

# CSAP 보안: 시크릿 참조
check "시크릿 참조 (하드코딩 금지)" \
    "$(grep -q 'secretKeyRef' "$BASE/infra/storage/data-lifecycle-cronjob.yaml" && echo true || echo false)"

# 보안: readOnlyRootFilesystem
check "readOnlyRootFilesystem 활성화" \
    "$(grep -q 'readOnlyRootFilesystem: true' "$BASE/infra/storage/data-lifecycle-cronjob.yaml" && echo true || echo false)"

echo ""
echo "=== 결과: $PASS/$TOTAL PASS, $FAIL FAIL ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
