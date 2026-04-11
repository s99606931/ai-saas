#!/usr/bin/env bash
# =============================================================================
# BuildKit 캐시 분산화 검증 스크립트
# Design Ref: MTU-N254 | Plan SC: SC-1 ~ SC-6
# =============================================================================
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
PASS=0; FAIL=0; WARN=0; TOTAL=0

check() {
  local desc="$1" result="$2"; TOTAL=$((TOTAL + 1))
  if [[ "$result" == "pass" ]]; then echo -e "  ${GREEN}[PASS]${NC} ${desc}"; PASS=$((PASS + 1))
  elif [[ "$result" == "warn" ]]; then echo -e "  ${YELLOW}[WARN]${NC} ${desc}"; WARN=$((WARN + 1))
  else echo -e "  ${RED}[FAIL]${NC} ${desc}"; FAIL=$((FAIL + 1)); fi
}

echo -e "${BOLD}=== MTU-N254: 빌드 캐시 분산화 검증 ===${NC}"
echo ""

# SC-1: BuildKit 원격 캐시 설정
echo -e "${BLUE}[SC-1] BuildKit 원격 캐시 설정${NC}"
F="$PROJECT_ROOT/infra/buildkit/buildkitd.toml"
[[ -f "$F" ]] && check "buildkitd.toml 존재" "pass" || check "buildkitd.toml 존재" "fail"
grep -q "gckeepstorage" "$F" 2>/dev/null && check "캐시 GC 설정" "pass" || check "캐시 GC 설정" "fail"
grep -q "harbor" "$F" 2>/dev/null && check "Harbor 레지스트리 설정" "pass" || check "Harbor 레지스트리 설정" "fail"
grep -q "gcpolicy" "$F" 2>/dev/null && check "GC 정책 설정" "pass" || check "GC 정책 설정" "fail"
echo ""

# SC-2: pnpm store 캐시
echo -e "${BLUE}[SC-2] pnpm store 캐시${NC}"
F="$PROJECT_ROOT/docs/guides/dockerfile-cache-optimization.md"
[[ -f "$F" ]] && check "Dockerfile 최적화 가이드 존재" "pass" || check "가이드 존재" "fail"
grep -q "pnpm" "$F" 2>/dev/null && check "pnpm 캐시 가이드" "pass" || check "pnpm 캐시 가이드" "fail"
grep -q "cache,target" "$F" 2>/dev/null && check "캐시 마운트 가이드" "pass" || check "캐시 마운트 가이드" "fail"
echo ""

# SC-3: Dockerfile 레이어 최적화
echo -e "${BLUE}[SC-3] Dockerfile 레이어 최적화 가이드${NC}"
grep -q "멀티 스테이지" "$F" 2>/dev/null && check "멀티 스테이지 빌드 패턴" "pass" || check "멀티 스테이지 빌드 패턴" "fail"
grep -q "dockerignore" "$F" 2>/dev/null && check ".dockerignore 가이드" "pass" || check ".dockerignore 가이드" "fail"
grep -q "cache-from" "$F" 2>/dev/null && check "원격 캐시 사용법" "pass" || check "원격 캐시 사용법" "fail"
echo ""

# SC-4: 캐시 모니터링 대시보드
echo -e "${BLUE}[SC-4] 캐시 모니터링 대시보드${NC}"
F="$PROJECT_ROOT/infra/monitoring/dashboards/build-cache.json"
[[ -f "$F" ]] && check "대시보드 JSON 존재" "pass" || check "대시보드 JSON 존재" "fail"
python3 -c "import json; json.load(open('$F'))" 2>/dev/null && check "JSON 유효성" "pass" || check "JSON 유효성" "fail"
grep -q "build:cache:hit_rate" "$F" 2>/dev/null && check "캐시 히트율 패널" "pass" || check "캐시 히트율 패널" "fail"
grep -q "build:duration" "$F" 2>/dev/null && check "빌드 시간 패널" "pass" || check "빌드 시간 패널" "fail"

F="$PROJECT_ROOT/infra/monitoring/build-cache-rules.yaml"
[[ -f "$F" ]] && check "Recording Rules 존재" "pass" || check "Recording Rules 존재" "fail"
grep -q "BuildCacheHitRateLow" "$F" 2>/dev/null && check "캐시 히트율 알림" "pass" || check "캐시 히트율 알림" "fail"
grep -q "BuildDurationHigh" "$F" 2>/dev/null && check "빌드 시간 알림" "pass" || check "빌드 시간 알림" "fail"
echo ""

# SC-5: 캐시 GC 자동화
echo -e "${BLUE}[SC-5] 캐시 GC 자동화${NC}"
F="$PROJECT_ROOT/infra/buildkit/cache-gc.sh"
[[ -f "$F" ]] && check "cache-gc.sh 존재" "pass" || check "cache-gc.sh 존재" "fail"
grep -q "prune" "$F" 2>/dev/null && check "캐시 정리 로직" "pass" || check "캐시 정리 로직" "fail"
grep -q "pnpm store" "$F" 2>/dev/null && check "pnpm store 정리" "pass" || check "pnpm store 정리" "fail"
grep -q "audit" "$F" 2>/dev/null && check "감사 로그 기록" "pass" || check "감사 로그 기록" "fail"
echo ""

# CSAP/문서
echo -e "${BLUE}[CSAP] 참조 검증${NC}"
[[ -f "$PROJECT_ROOT/docs/01-plan/mtus/MTU-N254-buildkit-cache.plan.md" ]] && check "Plan 문서" "pass" || check "Plan 문서" "fail"
[[ -f "$PROJECT_ROOT/docs/02-design/mtus/MTU-N254-buildkit-cache.design.md" ]] && check "Design 문서" "pass" || check "Design 문서" "fail"

echo ""
echo -e "${BOLD}=== 검증 결과 ===${NC}"
echo -e "  통과: ${GREEN}${PASS}${NC} / ${TOTAL}"; echo -e "  실패: ${RED}${FAIL}${NC} / ${TOTAL}"
MATCH_RATE=$(echo "scale=1; ${PASS} * 100 / ${TOTAL}" | bc 2>/dev/null || echo "0")
echo -e "  매치율: ${BOLD}${MATCH_RATE}%${NC}"
if [[ "$FAIL" -eq 0 ]]; then echo -e "${GREEN}${BOLD}MTU-N254: 검증 통과${NC}"; exit 0
elif [[ "$(echo "$MATCH_RATE >= 90" | bc 2>/dev/null)" == "1" ]]; then echo -e "${YELLOW}${BOLD}MTU-N254: 조건부 통과 (${MATCH_RATE}%)${NC}"; exit 0
else echo -e "${RED}${BOLD}MTU-N254: 검증 실패${NC}"; exit 1; fi
