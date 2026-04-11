#!/usr/bin/env bash
# =============================================================================
# Kyverno 정책 사전 검증 (Dry-Run)
# Design Ref: MTU-N246 S3.4
# Plan SC: FR-N246.4
# CSAP: D-08 (접근 통제), D-11 (가상화 보안)
#
# 사용법:
#   ./scripts/kyverno-dry-run.sh                    # 전체 검증
#   ./scripts/kyverno-dry-run.sh --env dev          # 특정 환경만
#   ./scripts/kyverno-dry-run.sh --policy verify-image  # 특정 정책만
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV_FILTER="${1:---all}"
POLICY_DIR="$PROJECT_DIR/infra/kyverno"
DEPLOY_DIR="$PROJECT_DIR/deploy"
PASS=0
FAIL=0
SKIP=0

echo "================================================================"
echo "  Kyverno 정책 사전 검증"
echo "  날짜: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "================================================================"

# Kyverno CLI 확인
if ! command -v kyverno &>/dev/null; then
  echo "[WARN] Kyverno CLI가 설치되지 않았습니다."
  echo "  설치: curl -sSfL https://github.com/kyverno/kyverno/releases/latest/download/kyverno-cli_linux_amd64.tar.gz | tar xz -C /usr/local/bin"
  echo "[SKIP] 사전 검증을 건너뜁니다."
  exit 0
fi

# 정책 파일 수집
POLICIES=()
if [ -f "$POLICY_DIR/verify-image-signature.yaml" ]; then
  POLICIES+=("$POLICY_DIR/verify-image-signature.yaml")
fi
if [ -f "$POLICY_DIR/require-labels.yaml" ]; then
  POLICIES+=("$POLICY_DIR/require-labels.yaml")
fi
for p in "$POLICY_DIR/policies/"*.yaml; do
  [ -f "$p" ] && POLICIES+=("$p")
done

if [ ${#POLICIES[@]} -eq 0 ]; then
  echo "[WARN] 검증할 Kyverno 정책이 없습니다."
  exit 0
fi

echo "  정책 수: ${#POLICIES[@]}"
echo ""

# 환경별 검증
ENVS=("base")
if [ "$ENV_FILTER" = "--all" ]; then
  ENVS+=("dev" "stg" "prod")
elif [[ "$ENV_FILTER" == --env=* ]] || [[ "$ENV_FILTER" == --env ]]; then
  # --env dev 또는 --env=dev
  if [[ "$ENV_FILTER" == --env=* ]]; then
    ENVS+=("${ENV_FILTER#--env=}")
  else
    ENVS+=("${2:-dev}")
  fi
fi

for env in "${ENVS[@]}"; do
  echo "--- 환경: $env ---"

  if [ "$env" = "base" ]; then
    RESOURCE_DIR="$DEPLOY_DIR/base"
  else
    RESOURCE_DIR="$DEPLOY_DIR/envs/$env"
  fi

  if [ ! -d "$RESOURCE_DIR" ]; then
    echo "  [SKIP] 디렉토리 없음: $RESOURCE_DIR"
    SKIP=$((SKIP + 1))
    continue
  fi

  # 각 리소스 파일에 대해 정책 검증
  for resource in "$RESOURCE_DIR"/*.yaml; do
    [ -f "$resource" ] || continue
    RESOURCE_NAME=$(basename "$resource")

    for policy in "${POLICIES[@]}"; do
      POLICY_NAME=$(basename "$policy")

      if kyverno apply "$policy" --resource "$resource" > /dev/null 2>&1; then
        echo "  [PASS] $RESOURCE_NAME ← $POLICY_NAME"
        PASS=$((PASS + 1))
      else
        echo "  [FAIL] $RESOURCE_NAME ← $POLICY_NAME"
        FAIL=$((FAIL + 1))
      fi
    done
  done
  echo ""
done

# 결과 요약
echo "================================================================"
echo "  검증 결과"
echo "================================================================"
echo "  통과: $PASS"
echo "  실패: $FAIL"
echo "  건너뜀: $SKIP"
echo "================================================================"

if [ "$FAIL" -gt 0 ]; then
  echo "[WARN] $FAIL 개 정책 위반 발견. 배포 전 수정이 필요합니다."
  # exit code 0으로 유지 (dry-run이므로 차단하지 않음)
fi

echo "[INFO] 실제 Enforce 모드에서는 Kyverno가 위반 리소스 배포를 차단합니다."
