#!/bin/bash
# 공공기관 SaaS 플랫폼 — PostgreSQL 백업 스크립트
# Design Ref: DESIGN-MTU-I1 k3s 인프라
# CSAP: D-07 재해복구 — 데이터 백업 및 보존 정책
#
# 사용법:
#   bash scripts/db-backup.sh                    # 기본 백업 (타임스탬프 파일명)
#   bash scripts/db-backup.sh --output /path     # 출력 경로 지정
#   bash scripts/db-backup.sh --retention 30     # 30일 보존 (기본 90일)
#
# 환경 변수:
#   DATABASE_URL  — PostgreSQL 접속 URL (필수)
#   BACKUP_DIR    — 백업 디렉토리 (기본: ./backups)
#
# CSAP D-07 요구사항:
#   - 일일 자동 백업 (cron 또는 k8s CronJob)
#   - 90일 보존 (감사 로그 최소 1년)
#   - 백업 무결성 검증 (SHA-256 해시)
#   - 암호화 저장 (gpg)

set -euo pipefail

# ──────────────────────────────────────────
# 설정
# ──────────────────────────────────────────
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS=90
OUTPUT_PATH=""

# 인수 파싱
while [[ $# -gt 0 ]]; do
  case $1 in
    --output)
      OUTPUT_PATH="$2"
      shift 2
      ;;
    --retention)
      RETENTION_DAYS="$2"
      shift 2
      ;;
    *)
      echo "알 수 없는 옵션: $1"
      exit 1
      ;;
  esac
done

# 색상
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ──────────────────────────────────────────
# 환경 변수 확인
# ──────────────────────────────────────────
if [ -z "${DATABASE_URL:-}" ]; then
  # .env 파일에서 로드 시도
  if [ -f ".env" ]; then
    # shellcheck disable=SC1091
    set -a && source .env && set +a
  fi

  if [ -z "${DATABASE_URL:-}" ]; then
    echo -e "${RED}오류: DATABASE_URL 환경 변수가 설정되지 않았습니다${NC}"
    echo "설정 예: export DATABASE_URL='postgresql://user:pass@localhost:5432/saas_db'"
    exit 1
  fi
fi

# URL에서 구성 요소 추출
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')

# ──────────────────────────────────────────
# 백업 디렉토리 준비
# ──────────────────────────────────────────
if [ -n "$OUTPUT_PATH" ]; then
  BACKUP_DIR="$OUTPUT_PATH"
fi
mkdir -p "$BACKUP_DIR"

BACKUP_FILE="${BACKUP_DIR}/saas_backup_${TIMESTAMP}.sql.gz"
HASH_FILE="${BACKUP_FILE}.sha256"

echo "================================================================"
echo " 공공기관 SaaS 플랫폼 — PostgreSQL 백업"
echo " 시각: $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================================"
echo ""
echo "데이터베이스: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
echo "백업 경로:    ${BACKUP_FILE}"
echo "보존 기간:    ${RETENTION_DAYS}일"
echo ""

# ──────────────────────────────────────────
# 1. pg_dump 실행 (gzip 압축)
# ──────────────────────────────────────────
echo -n "백업 진행 중... "

export PGPASSWORD="$DB_PASS"

if pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --format=custom \
  --compress=9 \
  --verbose \
  --no-owner \
  --no-privileges \
  2>"${BACKUP_DIR}/backup_${TIMESTAMP}.log" \
  | gzip > "$BACKUP_FILE"; then
  echo -e "${GREEN}완료${NC}"
else
  echo -e "${RED}실패${NC}"
  echo "로그: ${BACKUP_DIR}/backup_${TIMESTAMP}.log"
  exit 1
fi

unset PGPASSWORD

# ──────────────────────────────────────────
# 2. 무결성 해시 생성 (SHA-256)
# ──────────────────────────────────────────
echo -n "무결성 해시 생성... "
sha256sum "$BACKUP_FILE" > "$HASH_FILE"
echo -e "${GREEN}완료${NC}"

# ──────────────────────────────────────────
# 3. 백업 크기 확인
# ──────────────────────────────────────────
BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "백업 크기:    ${BACKUP_SIZE}"

# ──────────────────────────────────────────
# 4. 오래된 백업 정리 (보존 정책)
# ──────────────────────────────────────────
echo -n "보존 정책 적용 (${RETENTION_DAYS}일 초과 삭제)... "
DELETED_COUNT=0
while IFS= read -r -d '' old_file; do
  rm -f "$old_file" "${old_file}.sha256"
  DELETED_COUNT=$((DELETED_COUNT + 1))
done < <(find "$BACKUP_DIR" -name "saas_backup_*.sql.gz" -mtime +"$RETENTION_DAYS" -print0 2>/dev/null)

if [ "$DELETED_COUNT" -gt 0 ]; then
  echo -e "${YELLOW}${DELETED_COUNT}개 삭제${NC}"
else
  echo -e "${GREEN}삭제 대상 없음${NC}"
fi

# ──────────────────────────────────────────
# 5. 결과 요약
# ──────────────────────────────────────────
TOTAL_BACKUPS=$(find "$BACKUP_DIR" -name "saas_backup_*.sql.gz" 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)

echo ""
echo "================================================================"
echo " 백업 완료"
echo "----------------------------------------------------------------"
echo " 파일:     ${BACKUP_FILE}"
echo " 크기:     ${BACKUP_SIZE}"
echo " 해시:     $(cat "$HASH_FILE" | cut -d' ' -f1 | head -c 16)..."
echo " 총 백업:  ${TOTAL_BACKUPS}개 (${TOTAL_SIZE})"
echo "================================================================"
