#!/bin/bash
# ============================================================================
# MTU-N132 운영 대시보드 통합 허브 — 검증 테스트
# Plan SC: FR-N132.5
# Design Ref: MTU-N132 Design §5
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DASHBOARD_DIR="${PROJECT_ROOT}/infra/monitoring/dashboards"
RULES_DIR="${PROJECT_ROOT}/infra/monitoring"

PASS=0
FAIL=0
SKIP=0

pass() { echo -e "  \033[0;32m[PASS]\033[0m $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  \033[0;31m[FAIL]\033[0m $1"; FAIL=$((FAIL + 1)); }
skip() { echo -e "  \033[1;33m[SKIP]\033[0m $1"; SKIP=$((SKIP + 1)); }

echo "============================================"
echo "  MTU-N132 운영 대시보드 통합 허브 테스트"
echo "============================================"
echo ""

# ──────────────────────────────────────────
# T1: 홈 대시보드 JSON 유효성
# ──────────────────────────────────────────
echo "T1: 홈 대시보드 JSON 유효성"
if [ -f "${DASHBOARD_DIR}/ops-hub-home.json" ]; then
    if command -v jq &>/dev/null; then
        if jq empty "${DASHBOARD_DIR}/ops-hub-home.json" 2>/dev/null; then
            pass "ops-hub-home.json JSON 구문 유효"
        else
            fail "ops-hub-home.json JSON 구문 오류"
        fi
    else
        skip "jq 미설치"
    fi
else
    fail "ops-hub-home.json 파일 없음"
fi

# ──────────────────────────────────────────
# T2: Recording Rules YAML 구문 검증
# ──────────────────────────────────────────
echo ""
echo "T2: Recording Rules YAML 구문 검증"
if [ -f "${RULES_DIR}/ops-hub-recording-rules.yaml" ]; then
    if command -v python3 &>/dev/null; then
        if python3 -c "import yaml; yaml.safe_load(open('${RULES_DIR}/ops-hub-recording-rules.yaml'))" 2>/dev/null; then
            pass "ops-hub-recording-rules.yaml YAML 구문 유효"
        else
            fail "ops-hub-recording-rules.yaml YAML 구문 오류"
        fi
    else
        skip "python3 미설치"
    fi
else
    fail "ops-hub-recording-rules.yaml 파일 없음"
fi

# ──────────────────────────────────────────
# T3: 드릴다운 대시보드 파일 존재 확인
# ──────────────────────────────────────────
echo ""
echo "T3: 드릴다운 대시보드 파일 존재 확인"
DRILLDOWN_DASHBOARDS=(
    "optimized-overview"
    "node-exporter-detail"
    "capacity-planning"
    "slo-overview"
    "service-red-metrics"
    "incident-management"
    "distributed-tracing"
    "log-explorer"
    "security-auth-events"
    "csap-compliance-status"
    "trivy-security-scan"
    "falco-runtime-security"
    "gatekeeper-dashboard"
    "finops-cost-analysis"
    "finops-dashboard"
    "vpa-rightsizing"
    "tenant-resource-usage"
    "pipeline-metrics"
    "gitops-status"
    "flux-drift-detection"
    "service-topology"
    "linkerd-dashboard"
)

for db in "${DRILLDOWN_DASHBOARDS[@]}"; do
    if [ -f "${DASHBOARD_DIR}/${db}.json" ] || [ -f "${DASHBOARD_DIR}/${db}.yaml" ]; then
        pass "대시보드 존재: ${db}"
    else
        fail "대시보드 누락: ${db}"
    fi
done

# ──────────────────────────────────────────
# T4: 6개 영역 상태 메트릭 정의 확인
# ──────────────────────────────────────────
echo ""
echo "T4: 6개 영역 상태 메트릭 정의 확인"
STATUS_METRICS=(
    "ops_hub:cluster:status"
    "ops_hub:slo:status"
    "ops_hub:incident:status"
    "ops_hub:security:status"
    "ops_hub:finops:status"
    "ops_hub:deploy:status"
    "ops_hub:overall:status"
)

for metric in "${STATUS_METRICS[@]}"; do
    if grep -q "record: ${metric}" "${RULES_DIR}/ops-hub-recording-rules.yaml"; then
        pass "Recording Rule 정의: ${metric}"
    else
        fail "Recording Rule 누락: ${metric}"
    fi
done

# ──────────────────────────────────────────
# T5: 패널 ID 중복 없음 확인
# ──────────────────────────────────────────
echo ""
echo "T5: 패널 ID 중복 확인"
if command -v jq &>/dev/null; then
    TOTAL_IDS=$(jq '[.panels[].id] | length' "${DASHBOARD_DIR}/ops-hub-home.json")
    UNIQUE_IDS=$(jq '[.panels[].id] | unique | length' "${DASHBOARD_DIR}/ops-hub-home.json")
    if [ "${TOTAL_IDS}" -eq "${UNIQUE_IDS}" ]; then
        pass "패널 ID 중복 없음 (${TOTAL_IDS}개)"
    else
        fail "패널 ID 중복 발견 (전체: ${TOTAL_IDS}, 고유: ${UNIQUE_IDS})"
    fi
else
    skip "jq 미설치"
fi

# ──────────────────────────────────────────
# T6: 홈 대시보드에 6개 영역 상태 패널 존재
# ──────────────────────────────────────────
echo ""
echo "T6: 홈 대시보드 상태 패널 확인"
if command -v jq &>/dev/null; then
    for area in cluster slo incident security finops deploy; do
        if jq -e ".panels[] | select(.targets[]?.expr == \"ops_hub:${area}:status\")" "${DASHBOARD_DIR}/ops-hub-home.json" >/dev/null 2>&1; then
            pass "상태 패널 존재: ${area}"
        else
            fail "상태 패널 누락: ${area}"
        fi
    done
else
    skip "jq 미설치"
fi

# ──────────────────────────────────────────
# T7: 네비게이션 스크립트 존재 및 실행 가능
# ──────────────────────────────────────────
echo ""
echo "T7: 네비게이션 스크립트 확인"
if [ -f "${SCRIPT_DIR}/generate-ops-hub.sh" ]; then
    pass "generate-ops-hub.sh 존재"
    if [ -x "${SCRIPT_DIR}/generate-ops-hub.sh" ]; then
        pass "generate-ops-hub.sh 실행 권한 있음"
    else
        fail "generate-ops-hub.sh 실행 권한 없음"
    fi
else
    fail "generate-ops-hub.sh 없음"
fi

# ──────────────────────────────────────────
# 결과 요약
# ──────────────────────────────────────────
echo ""
echo "============================================"
echo "  테스트 결과 요약"
echo "============================================"
TOTAL=$((PASS + FAIL + SKIP))
echo "  전체: ${TOTAL} | PASS: ${PASS} | FAIL: ${FAIL} | SKIP: ${SKIP}"

if [ ${FAIL} -eq 0 ]; then
    echo -e "  \033[0;32m결과: ALL PASS\033[0m"
    exit 0
else
    echo -e "  \033[0;31m결과: ${FAIL}건 실패\033[0m"
    exit 1
fi
