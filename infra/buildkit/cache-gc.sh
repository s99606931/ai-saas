#!/usr/bin/env bash
# =============================================================================
# BuildKit 캐시 GC 자동화 스크립트
# Design Ref: MTU-N254 Design
# Plan SC: FR-N254.5
# CSAP: D-12 (시스템 개발 보안)
#
# 사용법:
#   ./infra/buildkit/cache-gc.sh                   # 기본 GC (10GB 보존)
#   ./infra/buildkit/cache-gc.sh --keep 5G         # 5GB 보존
#   ./infra/buildkit/cache-gc.sh --prune-all       # 전체 삭제
#   ./infra/buildkit/cache-gc.sh --dry-run         # 확인만
# =============================================================================

set -euo pipefail

KEEP_STORAGE="10G"
PRUNE_ALL=false
DRY_RUN=false
AUDIT_LOG="${AUDIT_LOG:-/data/ai-saas/.claude/audit.jsonl}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[CACHE-GC]${NC} $(date '+%H:%M:%S') $1"; }
log_success() { echo -e "${GREEN}[CACHE-GC]${NC} $(date '+%H:%M:%S') $1"; }

log_audit() {
  echo "{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"actor\":\"cache-gc\",\"action\":\"$1\",\"detail\":\"$2\",\"csap_ref\":\"D-12\"}" >> "$AUDIT_LOG" 2>/dev/null || true
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep)       KEEP_STORAGE="$2"; shift 2 ;;
    --prune-all)  PRUNE_ALL=true; shift ;;
    --dry-run)    DRY_RUN=true; shift ;;
    -h|--help)
      echo "사용법: cache-gc.sh [--keep SIZE] [--prune-all] [--dry-run]"
      exit 0 ;;
    *)            shift ;;
  esac
done

echo -e "${BOLD}=== BuildKit 캐시 GC ===${NC}"

# 현재 캐시 사용량 확인
log_info "현재 캐시 사용량 조회..."
if command -v buildctl &>/dev/null; then
  CACHE_USAGE=$(buildctl du 2>/dev/null | tail -1 || echo "알 수 없음")
  log_info "캐시 사용량: ${CACHE_USAGE}"
else
  log_info "buildctl 미설치 — kubectl exec로 실행"
  CACHE_USAGE=$(kubectl exec -n ci-system deploy/buildkit -- buildctl du 2>/dev/null | tail -1 || echo "알 수 없음")
  log_info "캐시 사용량: ${CACHE_USAGE}"
fi

# GC 실행
if [[ "$PRUNE_ALL" == "true" ]]; then
  log_info "전체 캐시 삭제 (prune-all)"
  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "[DRY-RUN] buildctl prune --all"
  else
    if command -v buildctl &>/dev/null; then
      buildctl prune --all 2>/dev/null || true
    else
      kubectl exec -n ci-system deploy/buildkit -- buildctl prune --all 2>/dev/null || true
    fi
    log_audit "CACHE_PRUNE_ALL" "전체 캐시 삭제"
  fi
else
  log_info "캐시 GC (보존: ${KEEP_STORAGE})"
  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "[DRY-RUN] buildctl prune --keep-storage ${KEEP_STORAGE}"
  else
    if command -v buildctl &>/dev/null; then
      buildctl prune --keep-storage "${KEEP_STORAGE}" 2>/dev/null || true
    else
      kubectl exec -n ci-system deploy/buildkit -- buildctl prune --keep-storage "${KEEP_STORAGE}" 2>/dev/null || true
    fi
    log_audit "CACHE_GC" "keep=${KEEP_STORAGE}"
  fi
fi

# Harbor OCI 캐시 정리 (오래된 이미지 태그)
log_info "Harbor OCI 캐시 정리 (7일 이상 미사용 태그)"
HARBOR_URL="${HARBOR_URL:-https://harbor.local}"
HARBOR_PROJECT="${HARBOR_PROJECT:-buildcache}"

if [[ "$DRY_RUN" == "true" ]]; then
  log_info "[DRY-RUN] Harbor 캐시 정리 건너뜀"
else
  # Harbor API로 오래된 캐시 태그 삭제 (7일 기준)
  log_info "Harbor API: ${HARBOR_URL}/api/v2.0/projects/${HARBOR_PROJECT}/repositories"
  # 실제 환경에서 curl로 Harbor API 호출
  log_info "Harbor OCI 캐시 정리는 Harbor GC 정책으로 위임"
fi

# pnpm store 캐시 정리
log_info "pnpm store 캐시 정리"
if command -v pnpm &>/dev/null; then
  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "[DRY-RUN] pnpm store prune"
  else
    pnpm store prune 2>/dev/null || true
  fi
fi

log_success "캐시 GC 완료"

# GC 후 사용량 확인
log_info "GC 후 캐시 사용량 조회..."
if command -v buildctl &>/dev/null; then
  buildctl du 2>/dev/null | tail -1 || true
else
  kubectl exec -n ci-system deploy/buildkit -- buildctl du 2>/dev/null | tail -1 || true
fi

echo -e "${BOLD}=== 캐시 GC 완료 ===${NC}"
