---
sidebar_position: 1
---

# 설치 가이드

## 사전 요구사항

| 도구 | 버전 | 필수 |
|------|------|------|
| Docker | 24.0+ | 필수 |
| Node.js | 20 LTS | 필수 |
| pnpm | 9.x | 필수 |
| Git | 2.40+ | 필수 |

## 설치

```bash
# 1. 저장소 클론
git clone https://github.com/your-org/public-saas-framework.git
cd public-saas-framework

# 2. 의존성 설치
pnpm install

# 3. 환경 변수 설정
cp docs/env.example .env
# .env 파일을 편집하여 필수 값 설정

# 4. 인프라 기동
docker compose up -d

# 5. DB 마이그레이션 + 시드 데이터
pnpm prisma migrate deploy
pnpm prisma db seed

# 6. 포털 실행
pnpm --filter @public-saas/portal dev
```

## 접속 확인

브라우저에서 `http://localhost:4000` 접속하여 로그인 화면이 표시되면 성공입니다.
