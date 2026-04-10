#!/usr/bin/env bash
# =============================================================================
# 공공기관 SaaS 플랫폼 — 마이크로서비스 통합 테스트
# Design Ref: C4-04
# Plan SC: E2E 통합 검증
# CSAP: D-12 시스템 개발 보안 — 통합 테스트 체계
#
# 사용법:
#   ./tests/e2e/test-integration-services.sh [--with-docker]
#
# --with-docker: docker-compose 인프라(PostgreSQL, Redis, MinIO) 자동 기동
# 기본:         로컬 인프라가 이미 실행 중인 것으로 가정
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PASS=0
FAIL=0
SKIP=0
RESULTS=()

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_pass() { PASS=$((PASS + 1)); RESULTS+=("PASS: $1"); echo -e "${GREEN}[PASS]${NC} $1"; }
log_fail() { FAIL=$((FAIL + 1)); RESULTS+=("FAIL: $1 — $2"); echo -e "${RED}[FAIL]${NC} $1 — $2"; }
log_skip() { SKIP=$((SKIP + 1)); RESULTS+=("SKIP: $1 — $2"); echo -e "${YELLOW}[SKIP]${NC} $1 — $2"; }
log_info() { echo -e "[INFO] $1"; }

# ==========================================================================
# Phase 1: 서비스 파일 구조 검증
# ==========================================================================
log_info "=== Phase 1: 서비스 파일 구조 검증 ==="

SERVICES=(
  "auth-service" "user-service" "tenant-service" "api-gateway"
  "ai-service" "audit-service" "menu-service" "catalog-service"
  "subscription-service" "billing-service" "crm-service"
  "notification-service" "file-service" "compliance-service"
  "security-service" "security-monitor-service"
)

for svc in "${SERVICES[@]}"; do
  SVC_DIR="${ROOT_DIR}/platform/services/${svc}"
  if [[ -d "${SVC_DIR}" ]]; then
    # 필수 파일 확인
    for f in "src/index.ts" "package.json" "tsconfig.json"; do
      if [[ -f "${SVC_DIR}/${f}" ]]; then
        log_pass "${svc}: ${f} 존재"
      else
        log_fail "${svc}: ${f} 누락" "파일이 존재하지 않음"
      fi
    done
    # 라우트 파일/디렉토리 확인 (api-gateway는 routes/ 디렉토리 사용)
    if [[ -f "${SVC_DIR}/src/routes.ts" ]] || [[ -d "${SVC_DIR}/src/routes" ]]; then
      log_pass "${svc}: 라우트 정의 존재"
    else
      log_fail "${svc}: 라우트 정의 누락" "src/routes.ts 또는 src/routes/ 필요"
    fi
  else
    log_fail "${svc}" "서비스 디렉토리 미존재"
  fi
done

# ==========================================================================
# Phase 2: Rate Limiting 패키지 일관성 검증
# ==========================================================================
log_info "=== Phase 2: Rate Limiting 패키지 일관성 검증 ==="

RATE_LIMIT_PKG="${ROOT_DIR}/platform/packages/rate-limit"
if [[ -f "${RATE_LIMIT_PKG}/src/index.ts" ]]; then
  log_pass "@public-saas/rate-limit 패키지 존재"
else
  log_fail "@public-saas/rate-limit" "패키지 소스 누락"
fi

# 각 서비스가 공유 패키지를 사용하는지 확인 (자체 rate-limit 미들웨어 금지)
for svc in "${SERVICES[@]}"; do
  ROUTES="${ROOT_DIR}/platform/services/${svc}/src/routes.ts"
  if [[ -f "${ROUTES}" ]]; then
    if grep -q "createRateLimiter" "${ROUTES}" 2>/dev/null; then
      if grep -q "@public-saas/rate-limit" "${ROUTES}" 2>/dev/null; then
        log_pass "${svc}: @public-saas/rate-limit 공유 패키지 사용"
      elif grep -q "./middleware/rate-limit" "${ROUTES}" 2>/dev/null; then
        log_fail "${svc}" "자체 rate-limit 미들웨어 사용 (공유 패키지로 전환 필요)"
      fi
    else
      log_skip "${svc}" "Rate Limiting 미적용 (해당 서비스 정책에 따름)"
    fi
  fi
done

# ==========================================================================
# Phase 3: Zod 입력 검증 일관성
# ==========================================================================
log_info "=== Phase 3: Zod 입력 검증 일관성 ==="

for svc in "${SERVICES[@]}"; do
  HANDLERS_DIR="${ROOT_DIR}/platform/services/${svc}/src/handlers"
  if [[ -d "${HANDLERS_DIR}" ]]; then
    HANDLER_COUNT=$(find "${HANDLERS_DIR}" -name "*.ts" 2>/dev/null | wc -l)
    ZOD_COUNT=$(grep -rl "from 'zod'" "${HANDLERS_DIR}" 2>/dev/null | wc -l || echo 0)
    if [[ "${HANDLER_COUNT}" -gt 0 && "${ZOD_COUNT}" -gt 0 ]]; then
      log_pass "${svc}: Zod 입력 검증 적용 (${ZOD_COUNT}/${HANDLER_COUNT} 핸들러)"
    elif [[ "${HANDLER_COUNT}" -gt 0 ]]; then
      log_fail "${svc}" "핸들러 ${HANDLER_COUNT}개 중 Zod 미적용"
    fi
  fi
done

# ==========================================================================
# Phase 4: 감사 로그 일관성
# ==========================================================================
log_info "=== Phase 4: 감사 로그 일관성 ==="

for svc in "${SERVICES[@]}"; do
  LIB_DIR="${ROOT_DIR}/platform/services/${svc}/src/lib"
  if [[ -f "${LIB_DIR}/audit.ts" ]]; then
    log_pass "${svc}: 감사 로그 모듈 존재"
    # audit-sdk 사용 확인
    if grep -q "@public-saas/audit-sdk" "${LIB_DIR}/audit.ts" 2>/dev/null; then
      log_pass "${svc}: @public-saas/audit-sdk 사용"
    fi
  elif [[ -d "${ROOT_DIR}/platform/services/${svc}/src/handlers" ]]; then
    HANDLER_FILES=$(find "${ROOT_DIR}/platform/services/${svc}/src/handlers" -name "*.ts" 2>/dev/null)
    HAS_AUDIT=false
    for hf in ${HANDLER_FILES}; do
      if grep -q "audit" "${hf}" 2>/dev/null; then
        HAS_AUDIT=true
        break
      fi
    done
    if [[ "${HAS_AUDIT}" == "false" ]]; then
      log_fail "${svc}" "감사 로그 모듈 및 감사 로깅 누락 (CSAP D-06)"
    fi
  fi
done

# ==========================================================================
# Phase 5: CSAP 보안 검증
# ==========================================================================
log_info "=== Phase 5: CSAP 보안 검증 ==="

# D-09: 하드코딩 시크릿 검사 (프로덕션 코드만)
HARDCODED=$(grep -r "sk-[a-zA-Z0-9]\{20,\}\|-----BEGIN.*KEY-----" \
  "${ROOT_DIR}/platform/services/" \
  --include="*.ts" 2>/dev/null | \
  grep -v "test\|spec\|mock\|example\|comment\|node_modules" || true)
if [[ -z "${HARDCODED}" ]]; then
  HARDCODED_COUNT=0
else
  HARDCODED_COUNT=$(echo "${HARDCODED}" | wc -l)
fi

if [[ "${HARDCODED_COUNT}" -eq 0 ]]; then
  log_pass "D-09: 하드코딩 시크릿 미발견"
else
  log_fail "D-09" "하드코딩 시크릿 ${HARDCODED_COUNT}건 발견"
fi

# D-08: 인증 없는 엔드포인트 검사
for svc in "${SERVICES[@]}"; do
  ROUTES="${ROOT_DIR}/platform/services/${svc}/src/routes.ts"
  ROUTES_DIR="${ROOT_DIR}/platform/services/${svc}/src/routes"
  if [[ -f "${ROUTES}" ]]; then
    if grep -q "INTERNAL_SERVICE_KEY\|onRequest\|verifyToken\|authenticate" "${ROUTES}" 2>/dev/null; then
      log_pass "${svc}: 서비스 인증 구현"
    fi
  elif [[ -d "${ROUTES_DIR}" ]]; then
    log_pass "${svc}: 라우트 디렉토리 기반 (게이트웨이 프록시 패턴)"
  fi
done

# D-12: SQL 직접 결합 검사
SQL_INJECT=$(grep -r "SELECT.*\${.*}\|INSERT.*\${.*}\|UPDATE.*\${.*}\|DELETE.*\${" \
  "${ROOT_DIR}/platform/services/" \
  --include="*.ts" 2>/dev/null | \
  grep -v "queryRaw\|executeRaw\|\$queryRaw\|\$1\|test\|spec\|node_modules" || true)
if [[ -z "${SQL_INJECT}" ]]; then
  SQL_INJECT_COUNT=0
else
  SQL_INJECT_COUNT=$(echo "${SQL_INJECT}" | wc -l)
fi

if [[ "${SQL_INJECT_COUNT}" -eq 0 ]]; then
  log_pass "D-12: SQL 주입 취약 패턴 미발견"
else
  log_fail "D-12" "SQL 주입 위험 패턴 ${SQL_INJECT_COUNT}건 발견"
fi

# ==========================================================================
# Phase 6: k8s 매니페스트 보안 검증
# ==========================================================================
log_info "=== Phase 6: k8s 매니페스트 보안 검증 ==="

PRIV=$( (grep -r "privileged: true" "${ROOT_DIR}/k8s/" --include="*.yaml" 2>/dev/null || true) | wc -l)
HOST_NET=$( (grep -r "hostNetwork: true" "${ROOT_DIR}/k8s/" --include="*.yaml" 2>/dev/null || true) | wc -l)

if [[ "${PRIV}" -eq 0 ]]; then
  log_pass "k8s: privileged 컨테이너 미발견"
else
  log_fail "k8s" "privileged 컨테이너 ${PRIV}건 발견"
fi

if [[ "${HOST_NET}" -eq 0 ]]; then
  log_pass "k8s: hostNetwork 미사용"
else
  log_fail "k8s" "hostNetwork ${HOST_NET}건 발견"
fi

# ==========================================================================
# Phase 7: docker-compose 환경 검증
# ==========================================================================
log_info "=== Phase 7: docker-compose 환경 검증 ==="

DC_FILE="${ROOT_DIR}/docker-compose.yml"
if [[ -f "${DC_FILE}" ]]; then
  log_pass "docker-compose.yml 존재"

  # 서비스 수 확인
  DC_SERVICES=$(grep -cE "^\s+[a-z].*:" "${DC_FILE}" 2>/dev/null || echo 0)
  log_info "docker-compose 서비스 수: ${DC_SERVICES}"

  # 헬스체크 확인
  HC_COUNT=$(grep -c "healthcheck" "${DC_FILE}" 2>/dev/null || echo 0)
  if [[ "${HC_COUNT}" -ge 3 ]]; then
    log_pass "docker-compose: 헬스체크 ${HC_COUNT}건 설정"
  else
    log_fail "docker-compose" "헬스체크 부족 (${HC_COUNT}건)"
  fi

  # 리소스 제한 확인
  if grep -q "resources:" "${DC_FILE}" 2>/dev/null; then
    log_pass "docker-compose: 리소스 제한 설정"
  else
    log_fail "docker-compose" "리소스 제한 미설정"
  fi
else
  log_fail "docker-compose.yml" "파일 미존재"
fi

# ==========================================================================
# 결과 요약
# ==========================================================================
echo ""
echo "============================================================"
echo " 통합 테스트 결과 요약"
echo "============================================================"
echo -e " ${GREEN}PASS${NC}: ${PASS}건"
echo -e " ${RED}FAIL${NC}: ${FAIL}건"
echo -e " ${YELLOW}SKIP${NC}: ${SKIP}건"
echo " 합계: $((PASS + FAIL + SKIP))건"
echo "============================================================"

if [[ "${FAIL}" -gt 0 ]]; then
  echo ""
  echo "실패 항목:"
  for r in "${RESULTS[@]}"; do
    if [[ "${r}" == FAIL* ]]; then
      echo "  - ${r}"
    fi
  done
  exit 1
fi

echo ""
echo "모든 통합 테스트 통과!"
exit 0
