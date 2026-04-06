---
sidebar_position: 3
---

# 보안 모델

## 보안 설계 원칙

1. **Zero Trust**: 모든 요청에 인증/인가 검사
2. **Defense in Depth**: 다계층 보안 적용
3. **Least Privilege**: 최소 권한 원칙
4. **Audit Trail**: 모든 민감 작업 감사 로그

## 암호화

| 영역 | 방식 | 알고리즘 |
|------|------|---------|
| 저장 | 대칭키 | AES-256 |
| 전송 | TLS | 1.3+ |
| 인증 | 비대칭키 | RS256 (JWT) |
| 비밀번호 | 해시 | bcrypt (12 라운드) |
