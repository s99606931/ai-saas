#!/bin/bash
# 공공기관 SaaS 플랫폼 — 전체 서비스 헬스체크
# Design Ref: DESIGN-MTU-DEP2
# Plan SC: FR-DEP2.3
#
# 사용법: bash scripts/healthcheck.sh

set -euo pipefail

# 서비스 목록 (이름:포트)
declare -a SERVICES=(
  "api-gateway:3000"
  "auth-service:3001"
  "user-service:3002"
  "tenant-service:3003"
  "menu-service:3004"
  "saas-catalog-service:3005"
  "subscription-service:3006"
  "billing-service:3007"
  "crm-service:3008"
  "ai-service:3009"
  "notification-service:3010"
  "file-service:3011"
  "audit-service:3012"
  "compliance-service:3013"
  "security-monitor-service:3014"
)

INFRA_SERVICES=(
  "postgres:5432"
  "redis:6379"
  "minio:9000"
)

PORTAL="portal:4000"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

TOTAL=0
PASSED=0
FAILED=0

echo "================================================================"
echo " 공공기관 SaaS 플랫폼 — 서비스 헬스체크"
echo " 시각: $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================================"
echo ""

# Docker Compose 컨테이너 상태 확인
echo "--- Docker 컨테이너 상태 ---"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "(docker compose ps 실행 실패)"
echo ""

# 인프라 서비스 확인
echo "--- 인프라 서비스 ---"
printf "%-30s %-10s\n" "서비스" "상태"
printf "%-30s %-10s\n" "------------------------------" "----------"

for svc in "${INFRA_SERVICES[@]}"; do
  name="${svc%%:*}"
  port="${svc##*:}"
  TOTAL=$((TOTAL + 1))

  container_status=$(docker compose ps "$name" --format "{{.Status}}" 2>/dev/null | head -1)
  if echo "$container_status" | grep -qi "healthy\|running"; then
    printf "%-30s ${GREEN}%-10s${NC}\n" "$name (:$port)" "HEALTHY"
    PASSED=$((PASSED + 1))
  else
    printf "%-30s ${RED}%-10s${NC}\n" "$name (:$port)" "UNHEALTHY"
    FAILED=$((FAILED + 1))
  fi
done

echo ""

# 마이크로서비스 HTTP 헬스체크
echo "--- 마이크로서비스 (HTTP /health) ---"
printf "%-30s %-10s %-10s\n" "서비스" "HTTP" "컨테이너"
printf "%-30s %-10s %-10s\n" "------------------------------" "----------" "----------"

for svc in "${SERVICES[@]}"; do
  name="${svc%%:*}"
  port="${svc##*:}"
  TOTAL=$((TOTAL + 1))

  # HTTP 헬스체크
  http_status="DOWN"
  http_code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/health" --connect-timeout 3 2>/dev/null || echo "000")
  if [ "$http_code" = "200" ]; then
    http_status="OK"
  fi

  # Docker 컨테이너 상태
  container_status=$(docker compose ps "$name" --format "{{.Status}}" 2>/dev/null | head -1)
  docker_status="DOWN"
  if echo "$container_status" | grep -qi "healthy\|running"; then
    docker_status="UP"
  fi

  if [ "$http_status" = "OK" ]; then
    printf "%-30s ${GREEN}%-10s${NC} ${GREEN}%-10s${NC}\n" "$name (:$port)" "$http_status" "$docker_status"
    PASSED=$((PASSED + 1))
  else
    printf "%-30s ${RED}%-10s${NC} ${YELLOW}%-10s${NC}\n" "$name (:$port)" "$http_status ($http_code)" "$docker_status"
    FAILED=$((FAILED + 1))
  fi
done

echo ""

# 포털 확인
echo "--- 포털 ---"
TOTAL=$((TOTAL + 1))
portal_name="${PORTAL%%:*}"
portal_port="${PORTAL##*:}"
portal_code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$portal_port/" --connect-timeout 3 2>/dev/null || echo "000")
if [ "$portal_code" = "200" ] || [ "$portal_code" = "302" ]; then
  printf "%-30s ${GREEN}%-10s${NC}\n" "$portal_name (:$portal_port)" "OK ($portal_code)"
  PASSED=$((PASSED + 1))
else
  printf "%-30s ${RED}%-10s${NC}\n" "$portal_name (:$portal_port)" "DOWN ($portal_code)"
  FAILED=$((FAILED + 1))
fi

echo ""
echo "================================================================"
echo " 결과: $PASSED/$TOTAL GREEN | $FAILED FAILED"
echo "================================================================"

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
