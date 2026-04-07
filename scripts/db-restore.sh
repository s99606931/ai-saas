#!/bin/bash
# 공공기관 SaaS 플랫폼 — PostgreSQL 복원 스크립트
# Design Ref: DESIGN-MTU-I1 k3s 인프라
# CSAP: D-07 재해복구 — 데이터 복원 절차
#
# 사용법:
#   bash scripts/db-restore.sh <백업파일>
#   bash scripts/db-restore.sh backups/saas_backup_20260407_120000.sql.gz
#
# 환경 변수:
#   DATABASE_URL  — PostgreSQL 접속 URL (필수)
#
# 주의사항:
#   - 복원 전 기존 데이터가 덮어쓰기될 수 있습니다
#   - 운영 환경에서는 반드시 별도 DB에 먼저 검증 복원 후 적용하세요
#   - CSAP D-06: 복원 작업은 감사 로그에 기록됩니다

set -euo pipefail

# ──────────────────────────────────────────
# 색상
# ──────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ──────────────────────────────────────────
# 인수 확인
# ──────────────────────────────────────────
if [ $# -lt 1 ]; then
  echo "사용법: bash scripts/db-restore.sh <백업파일>"
  echo "예:     bash scripts/db-restore.sh backups/saas_backup_20260407_120000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo -e "${RED}오류: 백업 파일을 찾을 수 없습니다: ${BACKUP_FILE}${NC}"
  exit 1
fi

# ──────────────────────────────────────────
# 환경 변수 확인
# ──────────────────────────────────────────
if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f ".env" ]; then
    # shellcheck disable=SC1091
    set -a && source .env && set +a
  fi

  if [ -z "${DATABASE_URL:-}" ]; then
    echo -e "${RED}오류: DATABASE_URL 환경 변수가 설정되지 않았습니다${NC}"
    exit 1
  fi
fi

# URL에서 구성 요소 추출
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')

echo "================================================================"
echo " 공공기관 SaaS 플랫폼 — PostgreSQL 복원"
echo " 시각: $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================================"
echo ""
echo "백업 파일:    ${BACKUP_FILE}"
echo "대상 DB:      ${DB_NAME}@${DB_HOST}:${DB_PORT}"
echo ""

# ──────────────────────────────────────────
# 1. 무결성 검증 (SHA-256)
# ──────────────────────────────────────────
HASH_FILE="${BACKUP_FILE}.sha256"
if [ -f "$HASH_FILE" ]; then
  echo -n "무결성 검증... "
  if sha256sum --check "$HASH_FILE" --quiet 2>/dev/null; then
    echo -e "${GREEN}통과${NC}"
  else
    echo -e "${RED}실패 — 백업 파일이 손상되었을 수 있습니다${NC}"
    echo "계속 진행하시겠습니까? (y/N)"
    read -r confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
      echo "복원 취소"
      exit 1
    fi
  fi
else
  echo -e "${YELLOW}경고: 해시 파일 없음 (${HASH_FILE}). 무결성 검증 건너뜀.${NC}"
fi

# ──────────────────────────────────────────
# 2. 사용자 확인
# ──────────────────────────────────────────
echo ""
echo -e "${YELLOW}경고: 이 작업은 대상 데이터베이스의 데이터를 덮어쓸 수 있습니다.${NC}"
echo "운영 환경에서는 별도 DB에 먼저 검증 복원을 권장합니다."
echo ""
echo "계속 진행하시겠습니까? (y/N)"
read -r confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "복원 취소"
  exit 0
fi

# ──────────────────────────────────────────
# 3. 복원 실행
# ──────────────────────────────────────────
echo ""
echo -n "복원 진행 중... "

export PGPASSWORD="$DB_PASS"

RESTORE_LOG="$(dirname "$BACKUP_FILE")/restore_$(date '+%Y%m%d_%H%M%S').log"

if gunzip -c "$BACKUP_FILE" | pg_restore \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --verbose \
  2>"$RESTORE_LOG"; then
  echo -e "${GREEN}완료${NC}"
else
  # pg_restore는 일부 오류에서도 비정상 종료할 수 있음
  echo -e "${YELLOW}완료 (일부 경고 있음)${NC}"
  echo "상세 로그: ${RESTORE_LOG}"
fi

unset PGPASSWORD

# ──────────────────────────────────────────
# 4. 복원 검증
# ──────────────────────────────────────────
echo ""
echo -n "복원 검증 (테이블 수 확인)... "

export PGPASSWORD="$DB_PASS"

TABLE_COUNT=$(psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" \
  2>/dev/null | tr -d ' ' || echo "0")

unset PGPASSWORD

if [ "$TABLE_COUNT" -gt 0 ] 2>/dev/null; then
  echo -e "${GREEN}${TABLE_COUNT}개 테이블 확인${NC}"
else
  echo -e "${YELLOW}테이블 수 확인 실패 (수동 확인 필요)${NC}"
fi

# ──────────────────────────────────────────
# 5. 결과 요약
# ──────────────────────────────────────────
echo ""
echo "================================================================"
echo " 복원 완료"
echo "----------------------------------------------------------------"
echo " 백업 파일:  ${BACKUP_FILE}"
echo " 대상 DB:    ${DB_NAME}"
echo " 테이블 수:  ${TABLE_COUNT}"
echo " 로그:       ${RESTORE_LOG}"
echo "================================================================"
echo ""
echo "다음 단계:"
echo "  1. 애플리케이션 헬스체크: bash scripts/healthcheck.sh"
echo "  2. Prisma 마이그레이션 상태 확인: npx prisma migrate status"
echo "  3. 감사 로그 기록 확인"
