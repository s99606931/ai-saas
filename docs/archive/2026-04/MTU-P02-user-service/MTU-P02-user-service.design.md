# MTU-P02: 사용자 관리 서비스 -- Design 문서

> **문서 ID**: DESIGN-MTU-P02
> **Plan 참조**: PLAN-MTU-P02
> **버전**: 1.1.0
> **작성일**: 2026-04-05
> **복잡도**: HIGH
> **아키텍처**: Option B -- Pragmatic Balance
> **작성자**: PM Agent + CTO Review

---

## Design Anchor

| Plan FR | 설계 결정 | 근거 |
|---------|---------|------|
| FR-P02.1 | Zod 스키마 + Prisma CRUD | CSAP D-12 입력 검증, 타입 안전 |
| FR-P02.4 | 소프트 삭제 (status 변경) | 감사 추적 보존, CSAP D-06 |
| FR-P02.5 | 5종 역할 (SUPER_ADMIN ~ AUDITOR) | CSAP D-08-05 세분화 RBAC |
| FR-P02.6 | 현재 비밀번호 확인 후 변경 | CSAP D-08-07 |
| FR-P02.9 | Tenant.maxUsers 체크 | N2SF N-03 테넌트 격리 할당량 |

---

## 1. 서비스 아키텍처

```
user-service/ (Fastify 5, 포트: 3002)
├── src/
│   ├── index.ts              # 서비스 진입점
│   ├── handlers/
│   │   ├── user.handler.ts    # 사용자 CRUD (목록/상세/생성/수정/삭제)
│   │   ├── role.handler.ts    # 역할 변경
│   │   └── password.handler.ts # 비밀번호 변경
│   └── routes.ts              # 라우트 등록
├── package.json
└── tsconfig.json
```

---

## 2. API 설계

| 메서드 | 경로 | 설명 | 권한 | Plan FR |
|--------|------|------|------|---------|
| GET | /users | 사용자 목록 (테넌트 필터, 페이지네이션) | user:read | FR-P02.2 |
| GET | /users/:id | 사용자 상세 | user:read | FR-P02.2 |
| POST | /users | 사용자 생성 | user:create | FR-P02.1 |
| PUT | /users/:id | 사용자 수정 | user:update | FR-P02.3 |
| DELETE | /users/:id | 사용자 비활성화 (소프트 삭제) | user:delete | FR-P02.4 |
| PUT | /users/:id/role | 역할 변경 | user:update:role | FR-P02.5 |
| PUT | /users/:id/password | 비밀번호 변경 (현재 확인 필수) | user:update:self | FR-P02.6 |

---

## 3. 데이터 모델 (Prisma)

User 모델은 MTU-P00에서 정의 완료:
- id, tenantId, email, name, passwordHash, role(5종), mfaEnabled, mfaSecret
- failedLogins, lockedUntil (MTU-P01 계정 잠금 연동)
- @@unique([tenantId, email]) -- 테넌트별 이메일 고유성

---

## 4. 보안 요건 매핑

| CSAP ID | 항목 | 구현 방법 |
|---------|------|---------|
| D-08-05 | 접근 권한 | 테넌트ID 기반 목록 필터링, RBAC 검사 |
| D-08-07 | 비밀번호 정책 | AUTH_CONSTANTS.PASSWORD_REGEX, bcrypt cost=12 |
| D-08-10 | 계정 관리 | 소프트 삭제 (감사 추적 보존) |
| D-12 | 입력 검증 | Zod 스키마 (createUserSchema, updateUserSchema, changePasswordSchema, changeRoleSchema) |
| N-03 | 테넌트 격리 | tenantId 필터 강제, maxUsers 할당량 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 초안 작성 | PM Agent |
| 1.1.0 | 2026-04-05 | 서비스 아키텍처, 데이터 모델, 보안 매핑 보완 | PM Agent |
