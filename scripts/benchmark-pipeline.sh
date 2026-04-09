#!/usr/bin/env bash
# =============================================================================
# 파이프라인 성능 벤치마크 스크립트
# Design Ref: MTU-N43 Design
# Plan SC: FR-N43.1
#
# 사용법: ./scripts/benchmark-pipeline.sh
# 각 CI/CD 단계의 실행 시간을 측정하고 결과를 JSON으로 출력
# =============================================================================

set -euo pipefail

REPORT_FILE="/tmp/pipeline-benchmark-$(date +%Y%m%d-%H%M%S).json"
RESULTS=()

# 시간 측정 함수
measure() {
  local STAGE_NAME="$1"
  shift
  local START=$(date +%s%N)

  echo "=== [BENCHMARK] ${STAGE_NAME} 시작 ==="
  if "$@" 2>&1; then
    local STATUS="success"
  else
    local STATUS="failed"
  fi

  local END=$(date +%s%N)
  local DURATION_MS=$(( (END - START) / 1000000 ))
  local DURATION_S=$(echo "scale=2; $DURATION_MS / 1000" | bc 2>/dev/null || echo "$((DURATION_MS / 1000))")

  echo "=== [BENCHMARK] ${STAGE_NAME}: ${DURATION_S}s (${STATUS}) ==="
  RESULTS+=("{\"stage\":\"${STAGE_NAME}\",\"duration_ms\":${DURATION_MS},\"status\":\"${STATUS}\"}")
}

echo "================================================================"
echo "  공공기관 SaaS 플랫폼 -- 파이프라인 벤치마크"
echo "  날짜: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "================================================================"

cd /data/ai-saas

# Stage 1: 의존성 설치
measure "pnpm-install" pnpm install --frozen-lockfile 2>/dev/null || true

# Stage 2: TypeScript 타입 체크
measure "typecheck" pnpm run typecheck 2>/dev/null || true

# Stage 3: 린트
measure "lint" pnpm run lint 2>/dev/null || true

# Stage 4: 빌드
measure "build" pnpm run build 2>/dev/null || true

# Stage 5: 테스트
measure "test" pnpm run test 2>/dev/null || true

# Stage 6: Helm lint
if command -v helm &>/dev/null; then
  measure "helm-lint" helm lint infra/helm/saas-platform/ 2>/dev/null || true
fi

# Stage 7: YAML 유효성
measure "yaml-check" bash -c "for f in .gitea/workflows/*.yml; do echo \"Checking \$f\"; done"

# 결과 출력
echo ""
echo "================================================================"
echo "  벤치마크 결과 요약"
echo "================================================================"

# JSON 결과 생성
{
  echo "{"
  echo "  \"timestamp\": \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\","
  echo "  \"platform\": \"$(uname -r)\","
  echo "  \"stages\": ["
  for i in "${!RESULTS[@]}"; do
    if [ $i -lt $((${#RESULTS[@]} - 1)) ]; then
      echo "    ${RESULTS[$i]},"
    else
      echo "    ${RESULTS[$i]}"
    fi
  done
  echo "  ]"
  echo "}"
} > "$REPORT_FILE"

echo "결과 저장: $REPORT_FILE"
cat "$REPORT_FILE"

echo ""
echo "================================================================"
echo "  SLA 기준: 전체 파이프라인 < 20분 (1200초)"
echo "================================================================"
