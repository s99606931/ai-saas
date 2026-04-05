# 포크 환경 설정 가이드

> FORK-GUIDE.md 보충 문서 — 환경 변수 설정 방법

## 환경 변수 목록

### 필수

| 변수 | 설명 | 예시 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 16 연결 | `postgresql://saas:saas@localhost:5432/public_saas` |
| `JWT_PRIVATE_KEY` | RS256 개인키 (PEM) | `openssl genpkey -algorithm RSA -out private.pem` |
| `JWT_PUBLIC_KEY` | RS256 공개키 (PEM) | `openssl rsa -in private.pem -pubout -out public.pem` |
| `ENCRYPTION_KEY` | AES-256 키 (32바이트 hex) | `openssl rand -hex 32` |
| `FILE_ENCRYPTION_KEY` | 파일 암호화 키 | `openssl rand -hex 32` |
| `REDIS_URL` | Redis 세션 관리 | `redis://localhost:6379` |

### 서비스 포트 (기본값)

| 서비스 | 포트 |
|--------|------|
| auth-service | 3000 |
| user-service | 3001 |
| tenant-service | 3002 |
| api-gateway | 3003 |
| menu-service | 3004 |
| catalog-service | 3005 |
| subscription-service | 3006 |
| billing-service | 3007 |
| crm-service | 3008 |
| ai-service | 3009 |
| notification-service | 3010 |
| file-service | 3011 |
| audit-service | 3012 |
| compliance-service | 3013 |
| security-service | 3014 |
| portal (Next.js) | 4000 |

### 선택

| 변수 | 설명 |
|------|------|
| `AI_API_URL` | LM Studio 등 호환 API URL |
| `AI_API_KEY` | AI API 키 |
| `LOG_LEVEL` | 로그 레벨 (info, debug, warn, error) |
