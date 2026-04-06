---
sidebar_position: 2
---

# 환경 설정

## 필수 환경 변수

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL 연결 문자열 | `postgresql://user:pass@localhost:5432/saas` |
| `JWT_PRIVATE_KEY` | JWT RS256 개인키 | PEM 형식 |
| `JWT_PUBLIC_KEY` | JWT RS256 공개키 | PEM 형식 |
| `ENCRYPTION_KEY` | AES-256 암호화 키 | 32바이트 hex 문자열 |
| `REDIS_URL` | Redis 연결 문자열 | `redis://localhost:6379` |

## JWT 키 생성

```bash
# RS256 키 쌍 생성
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

## 암호화 키 생성

```bash
# AES-256 키 생성 (32바이트)
openssl rand -hex 32
```
