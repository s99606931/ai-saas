#!/bin/bash
# 공공 SaaS 프레임워크 — 포크 환경 구성 스크립트
# Design Ref: DESIGN-MTU-P19
# 사용법: chmod +x scripts/setup-fork.sh && ./scripts/setup-fork.sh

set -euo pipefail

echo "=== 공공 SaaS 프레임워크 포크 환경 구성 ==="

# 1. .env 파일 생성
if [ ! -f .env ]; then
  cp .env.example .env
  echo "[OK] .env 파일 생성 완료 — 환경 변수를 편집하세요"
else
  echo "[SKIP] .env 파일이 이미 존재합니다"
fi

# 2. pnpm 의존성 설치
if command -v pnpm &> /dev/null; then
  echo "[INFO] pnpm 의존성 설치 중..."
  pnpm install
  echo "[OK] 의존성 설치 완료"
else
  echo "[WARN] pnpm이 설치되어 있지 않습니다. 먼저 설치하세요: npm i -g pnpm"
fi

# 3. Git 훅 설정
echo "[INFO] Git 훅 설정 중..."
git config core.hooksPath .githooks 2>/dev/null || true
echo "[OK] Git 훅 설정 완료"

# 4. 디렉토리 구조 확인
echo ""
echo "=== 환경 구성 완료 ==="
echo ""
echo "다음 단계:"
echo "  1. .env 파일을 편집하여 환경 변수를 설정하세요"
echo "  2. docker compose up -d 로 의존 서비스를 기동하세요"
echo "  3. pnpm prisma migrate deploy 로 DB를 마이그레이션하세요"
echo "  4. FORK-GUIDE.md를 참고하여 비즈니스 서비스를 개발하세요"
echo ""
echo "자세한 내용: FORK-GUIDE.md"
