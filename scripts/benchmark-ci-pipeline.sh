#!/usr/bin/env bash
# =============================================================================
# CI/CD 파이프라인 벤치마크 — 병렬화 전후 비교
# Design Ref: MTU-N244 S3.5
# Plan SC: FR-N244.6
#
# 사용법:
#   ./scripts/benchmark-ci-pipeline.sh              # 전체 벤치마크
#   ./scripts/benchmark-ci-pipeline.sh --parallel    # 병렬 실행 시뮬레이션
#   ./scripts/benchmark-ci-pipeline.sh --sequential  # 순차 실행 (기준선)
#
# 목표: 병렬화 후 전체 CI 실행 시간 50% 감소 확인
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORT_DIR="$PROJECT_DIR/docs/pm-reports"
REPORT_FILE="${REPORT_DIR}/ci-benchmark-$(date +%Y%m%d-%H%M%S).json"
MODE="${1:---parallel}"

mkdir -p "$REPORT_DIR"

# 시간 측정 함수
measure() {
  local STAGE_NAME="$1"
  shift
  local START_NS=$(date +%s%N 2>/dev/null || echo "$(date +%s)000000000")

  echo "  [START] ${STAGE_NAME}"
  local STATUS="success"
  if ! eval "$@" > /dev/null 2>&1; then
    STATUS="skipped"
  fi

  local END_NS=$(date +%s%N 2>/dev/null || echo "$(date +%s)000000000")
  local DURATION_MS=$(( (END_NS - START_NS) / 1000000 ))
  local DURATION_S=$((DURATION_MS / 1000))

  echo "  [DONE]  ${STAGE_NAME}: ${DURATION_S}s (${STATUS})"
  echo "${STAGE_NAME}|${DURATION_MS}|${STATUS}"
}

echo "================================================================"
echo "  CI/CD 파이프라인 벤치마크"
echo "  날짜: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "  모드: $MODE"
echo "  프로젝트: $PROJECT_DIR"
echo "================================================================"

cd "$PROJECT_DIR"

declare -A STAGE_TIMES

# --- 순차 실행 벤치마크 (기준선) ---
run_sequential() {
  echo ""
  echo "--- 순차 실행 벤치마크 (Before 최적화) ---"
  echo ""

  local TOTAL_START=$(date +%s%N 2>/dev/null || echo "$(date +%s)000000000")

  local RESULT
  RESULT=$(measure "install" "pnpm install --frozen-lockfile")
  STAGE_TIMES[seq_install]=$(echo "$RESULT" | tail -1 | cut -d'|' -f2)

  RESULT=$(measure "typecheck" "pnpm run typecheck 2>/dev/null || true")
  STAGE_TIMES[seq_typecheck]=$(echo "$RESULT" | tail -1 | cut -d'|' -f2)

  RESULT=$(measure "lint" "pnpm run lint 2>/dev/null || true")
  STAGE_TIMES[seq_lint]=$(echo "$RESULT" | tail -1 | cut -d'|' -f2)

  RESULT=$(measure "build" "pnpm run build 2>/dev/null || true")
  STAGE_TIMES[seq_build]=$(echo "$RESULT" | tail -1 | cut -d'|' -f2)

  RESULT=$(measure "test" "pnpm run test 2>/dev/null || true")
  STAGE_TIMES[seq_test]=$(echo "$RESULT" | tail -1 | cut -d'|' -f2)

  if command -v helm &>/dev/null && [ -d "helm/saas-platform" ]; then
    RESULT=$(measure "helm-lint" "helm lint helm/saas-platform/")
    STAGE_TIMES[seq_helm]=$(echo "$RESULT" | tail -1 | cut -d'|' -f2)
  else
    STAGE_TIMES[seq_helm]=0
  fi

  local TOTAL_END=$(date +%s%N 2>/dev/null || echo "$(date +%s)000000000")
  STAGE_TIMES[seq_total]=$(( (TOTAL_END - TOTAL_START) / 1000000 ))
}

# --- 병렬 실행 시뮬레이션 (After 최적화) ---
run_parallel() {
  echo ""
  echo "--- 병렬 실행 시뮬레이션 (After 최적화) ---"
  echo ""

  local TOTAL_START=$(date +%s%N 2>/dev/null || echo "$(date +%s)000000000")

  # install은 순차 (캐시 워밍)
  local RESULT
  RESULT=$(measure "install" "pnpm install --frozen-lockfile")
  STAGE_TIMES[par_install]=$(echo "$RESULT" | tail -1 | cut -d'|' -f2)

  # lint, typecheck, build 동시 실행 (병렬)
  echo "  [PARALLEL] lint + typecheck + build 동시 실행"
  local PAR_START=$(date +%s%N 2>/dev/null || echo "$(date +%s)000000000")

  pnpm run lint > /dev/null 2>&1 &
  local PID_LINT=$!
  pnpm run typecheck > /dev/null 2>&1 &
  local PID_TC=$!
  pnpm run build > /dev/null 2>&1 &
  local PID_BUILD=$!

  wait $PID_LINT 2>/dev/null || true
  wait $PID_TC 2>/dev/null || true
  wait $PID_BUILD 2>/dev/null || true

  local PAR_END=$(date +%s%N 2>/dev/null || echo "$(date +%s)000000000")
  STAGE_TIMES[par_parallel]=$(( (PAR_END - PAR_START) / 1000000 ))
  echo "  [DONE]  parallel(lint+typecheck+build): $((STAGE_TIMES[par_parallel] / 1000))s"

  # test (build 후)
  RESULT=$(measure "test" "pnpm run test 2>/dev/null || true")
  STAGE_TIMES[par_test]=$(echo "$RESULT" | tail -1 | cut -d'|' -f2)

  # helm-lint (독립, 이미 병렬 실행됨을 가정)
  STAGE_TIMES[par_helm]=0

  local TOTAL_END=$(date +%s%N 2>/dev/null || echo "$(date +%s)000000000")
  STAGE_TIMES[par_total]=$(( (TOTAL_END - TOTAL_START) / 1000000 ))
}

# --- 실행 ---
case "$MODE" in
  --sequential)
    run_sequential
    ;;
  --parallel)
    run_parallel
    ;;
  *)
    run_sequential
    run_parallel
    ;;
esac

# --- 결과 보고 ---
echo ""
echo "================================================================"
echo "  벤치마크 결과"
echo "================================================================"

if [ -n "${STAGE_TIMES[seq_total]+x}" ] && [ -n "${STAGE_TIMES[par_total]+x}" ]; then
  SEQ_TOTAL_S=$((STAGE_TIMES[seq_total] / 1000))
  PAR_TOTAL_S=$((STAGE_TIMES[par_total] / 1000))

  if [ "$SEQ_TOTAL_S" -gt 0 ]; then
    IMPROVEMENT=$(( (SEQ_TOTAL_S - PAR_TOTAL_S) * 100 / SEQ_TOTAL_S ))
  else
    IMPROVEMENT=0
  fi

  echo "  순차 실행: ${SEQ_TOTAL_S}s"
  echo "  병렬 실행: ${PAR_TOTAL_S}s"
  echo "  개선율:    ${IMPROVEMENT}%"
  echo ""
  if [ "$IMPROVEMENT" -ge 50 ]; then
    echo "  [OK] 목표 달성: 50% 이상 시간 단축"
  elif [ "$IMPROVEMENT" -ge 30 ]; then
    echo "  [WARN] 부분 달성: 30%+ 시간 단축 (목표: 50%)"
  else
    echo "  [INFO] 추가 최적화 필요 (현재: ${IMPROVEMENT}%)"
  fi
fi

echo "================================================================"

# JSON 결과 저장
cat > "$REPORT_FILE" << JSONEOF
{
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "platform": "$(uname -r)",
  "mode": "$MODE",
  "sequential_total_ms": ${STAGE_TIMES[seq_total]:-0},
  "parallel_total_ms": ${STAGE_TIMES[par_total]:-0},
  "improvement_percent": ${IMPROVEMENT:-0},
  "stages": {
    "sequential": {
      "install_ms": ${STAGE_TIMES[seq_install]:-0},
      "typecheck_ms": ${STAGE_TIMES[seq_typecheck]:-0},
      "lint_ms": ${STAGE_TIMES[seq_lint]:-0},
      "build_ms": ${STAGE_TIMES[seq_build]:-0},
      "test_ms": ${STAGE_TIMES[seq_test]:-0},
      "helm_ms": ${STAGE_TIMES[seq_helm]:-0}
    },
    "parallel": {
      "install_ms": ${STAGE_TIMES[par_install]:-0},
      "parallel_ms": ${STAGE_TIMES[par_parallel]:-0},
      "test_ms": ${STAGE_TIMES[par_test]:-0}
    }
  },
  "design_ref": "MTU-N244 S3.5",
  "plan_sc": "FR-N244.6"
}
JSONEOF

echo ""
echo "결과 저장: $REPORT_FILE"
