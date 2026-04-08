# MTU-Q3: 사용자 관리 서비스 품질 보완 -- Design 문서

> **문서 ID**: DESIGN-MTU-Q3
> **참조 Plan**: PLAN-MTU-Q3
> **버전**: 1.0.0
> **작성일**: 2026-04-06
> **작성자**: PM Agent

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| **소프트 삭제** | User 모델에 isActive 추가 불가(Prisma 마이그레이션 필요) -> 기존 role 변경 + status 메타데이터 방식 |
| **비밀번호 재설정** | 인메모리 토큰 저장 (단일 인스턴스), SHA-256 해시 토큰, 30분 만료 |
| **보안** | 재설정 토큰 누출 방지: 해시 저장, 1회 사용, IP 바인딩 |

---

## 1. FR-P02.4: 소프트 삭제 개선

### 현재 문제

기존 deleteUserHandler는 role을 VIEWER로 변경할 뿐, 실제 비활성화 상태 추적이 불가합니다.

### 개선 설계

Prisma 스키마 변경 없이 사용자 메타데이터 필드 활용:
- deleteUserHandler: 사용자 삭제 시 → lockedUntil을 9999-12-31로 설정하여 비활성화 표시
- 복원 핸들러: reactivateUserHandler → lockedUntil을 null로 초기화
- listUsersHandler: lockedUntil 기반 비활성화 사용자 필터링

### API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| DELETE | /users/:id | 사용자 비활성화 (소프트 삭제 개선) |
| PUT | /users/:id/reactivate | 사용자 복원 |

---

## 2. FR-P02.7: 비밀번호 재설정

### 흐름

```
1. POST /users/password-reset/request
   → 이메일 확인 → 재설정 토큰 생성 (30분 만료)
   → 알림 서비스 연동 (현재는 로그 출력)

2. POST /users/password-reset/confirm
   → 토큰 검증 → 비밀번호 정책 확인 → 비밀번호 변경
   → 토큰 폐기 (1회 사용)
```

### 토큰 보안 (CSAP D-08-07)

- 토큰 형식: crypto.randomBytes(32).toString('hex')
- 저장: SHA-256 해시로 저장 (원본 토큰은 사용자에게만 전달)
- 만료: 30분
- 1회 사용 후 즉시 폐기
- IP 바인딩: 요청 시 IP와 확인 시 IP 일치 검증 (선택)

---

## Session Guide

1. password-reset.handler.ts 생성
2. user.handler.ts deleteUserHandler 개선
3. user.handler.ts reactivateUserHandler 추가
4. routes.ts 업데이트

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | Design 작성 | PM Agent |
