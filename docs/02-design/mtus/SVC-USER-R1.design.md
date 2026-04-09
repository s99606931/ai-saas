# Design: SVC-USER-R1 -- 사용자 서비스 고도화 라운드 1

> 작성일: 2026-04-09 | 버전: 1.0 | 작성자: PM Lead
> Plan: docs/01-plan/mtus/SVC-USER-R1.plan.md
> PRD: docs/00-pm/SVC-USER-R1.prd.md

---

## Design Anchor

- **아키텍처 옵션**: Pragmatic Balance 선택
- **기술 스택**: Fastify 5.x, Prisma, Redis, Zod, bcryptjs
- **보안 기준**: CSAP D-08-05/07/10, D-10, D-06

---

## Section 1: FR-USR.1 사용자 검색 및 필터링

### 1.1 변경 파일

- `platform/services/user-service/src/handlers/user.handler.ts` -- listUsersHandler 확장

### 1.2 설계

기존 listUsersHandler를 확장하여 검색/필터링/정렬 쿼리 파라미터를 추가합니다.

**쿼리 파라미터**:
```
GET /users?search=홍길&role=USER&status=active&sortBy=name&sortOrder=asc&page=1&pageSize=20
```

- `search`: 이름 또는 이메일 부분 일치 (Prisma `contains` + `mode: 'insensitive'`)
- `role`: 역할 필터 (TENANT_ADMIN|USER|VIEWER|AUDITOR)
- `status`: active(lockedUntil=null 또는 과거), inactive(영구잠금), locked(임시잠금)
- `sortBy`: name|email|createdAt|lastLoginAt (기본: createdAt)
- `sortOrder`: asc|desc (기본: desc)

**Prisma where 조건 빌더**:
```typescript
const where: Prisma.UserWhereInput = { tenantId };
if (search) {
  where.OR = [
    { name: { contains: search, mode: 'insensitive' } },
    { email: { contains: search, mode: 'insensitive' } },
  ];
}
if (role) where.role = role;
if (status === 'active') where.OR_lock = lockedUntil null or < now;
if (status === 'inactive') where.lockedUntil = PERMANENT_LOCK;
if (status === 'locked') where.lockedUntil = { gt: now, lt: PERMANENT_LOCK };
```

---

## Section 2: FR-USR.2 비활성 계정 감지

### 2.1 변경 파일

- `platform/services/user-service/src/handlers/inactive.handler.ts` (NEW)

### 2.2 설계

```
GET /users/inactive?days=90&tenantId=xxx
```

- `days`: 비활성 기준 일수 (기본 90, 환경 변수 INACTIVE_THRESHOLD_DAYS)
- 조건: lastLoginAt이 null이거나 기준일보다 과거
- 비활성화(soft-delete)된 사용자 제외 (lockedUntil = 영구잠금 제외)
- SUPER_ADMIN: 전체 테넌트 조회 가능, 테넌트별 통계 포함
- 일반: 본인 테넌트만

**응답 형식**:
```json
{
  "success": true,
  "data": {
    "users": [...],
    "summary": {
      "totalInactive": 15,
      "neverLoggedIn": 3,
      "lastLogin90DaysAgo": 12
    }
  }
}
```

---

## Section 3: FR-USR.3 Rate Limiting

### 3.1 변경 파일

- `platform/services/user-service/src/middleware/rate-limit.middleware.ts` (NEW)
- `platform/services/user-service/src/routes.ts` (MODIFIED)

### 3.2 설계

auth-service rate-limit.middleware.ts 패턴 동일 적용:
- Redis INCR + EXPIRE 고정 윈도우
- X-RateLimit-Limit/Remaining/Reset 응답 헤더
- 429 상태 코드 + retryAfter 필드
- Redis 미연결 시 통과 허용 (가용성 우선)

---

## Section 4: FR-USR.4 서비스 간 HMAC 인증

### 4.1 변경 파일

- `platform/services/user-service/src/lib/service-auth.ts` (NEW)
- `platform/services/user-service/src/handlers/password.handler.ts` (MODIFIED)
- `platform/services/user-service/src/handlers/password-reset.handler.ts` (MODIFIED)

### 4.2 설계

auth-service service-auth.middleware.ts의 generateServiceToken 함수 추출:
```typescript
export function generateServiceToken(serviceName: string, secret: string): string {
  const timestamp = Date.now().toString();
  const hmac = createHmac('sha256', secret)
    .update(`${serviceName}:${timestamp}`)
    .digest('hex');
  return `${serviceName}:${timestamp}:${hmac}`;
}
```

password.handler.ts, password-reset.handler.ts의 auth-service 호출부에 X-Service-Token 헤더 추가.

---

## Section 5: FR-USR.5 비밀번호 이력 관리

### 5.1 변경 파일

- `platform/services/user-service/src/lib/password-history.ts` (NEW)
- `platform/services/user-service/src/handlers/password.handler.ts` (MODIFIED)
- `platform/services/user-service/src/handlers/password-reset.handler.ts` (MODIFIED)

### 5.2 설계

**인메모리 이력 저장소** (단일 인스턴스, Phase 2에서 DB 마이그레이션):
```typescript
// Map<userId, hashedPassword[]> -- 최근 N개만 유지
const passwordHistoryStore = new Map<string, string[]>();
const HISTORY_COUNT = parseInt(process.env['PASSWORD_HISTORY_COUNT'] ?? '5', 10);
```

**비교 로직**:
```typescript
export async function isPasswordReused(userId: string, newPassword: string): Promise<boolean> {
  const history = passwordHistoryStore.get(userId) ?? [];
  for (const oldHash of history) {
    if (await bcrypt.compare(newPassword, oldHash)) return true;
  }
  return false;
}

export function addPasswordHistory(userId: string, passwordHash: string): void {
  const history = passwordHistoryStore.get(userId) ?? [];
  history.unshift(passwordHash);
  if (history.length > HISTORY_COUNT) history.pop();
  passwordHistoryStore.set(userId, history);
}
```

---

## Section 6: FR-USR.6 프로필 메타데이터

### 6.1 변경 파일

- `platform/services/user-service/src/handlers/user.handler.ts` (MODIFIED)

### 6.2 설계

updateUserSchema 확장:
```typescript
const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  mfaEnabled: z.boolean().optional(),
  department: z.string().max(100).optional(),
  position: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
});
```

Prisma User 모델의 metadata JSON 필드 활용 (department, position, phone은 metadata에 저장).
getUserHandler, listUsersHandler의 select에 metadata 필드 추가.

---

## Session Guide

1. FR-USR.1 검색/필터링 구현 → 테스트
2. FR-USR.2 비활성 계정 감지 구현 → 테스트
3. FR-USR.3 Rate Limiting 구현 → 테스트
4. FR-USR.4 HMAC 서비스 인증 구현 → 테스트
5. FR-USR.5 비밀번호 이력 구현 → 테스트
6. FR-USR.6 프로필 메타데이터 구현 → 테스트
7. 전체 빌드 + 테스트 확인
