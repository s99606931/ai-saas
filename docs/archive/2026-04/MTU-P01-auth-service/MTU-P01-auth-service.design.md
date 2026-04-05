# MTU-P01: 인증 서비스 — Design 문서

> **문서 ID**: DESIGN-MTU-P01
> **Plan 참조**: PLAN-MTU-P01
> **버전**: 1.0.0
> **작성일**: 2026-04-05
> **복잡도**: HIGH
> **아키텍처**: Option B — Pragmatic Balance
> **작성자**: PM Agent + CTO Review

---

## Design Anchor

| Plan FR | 설계 결정 | 근거 |
|---------|---------|------|
| FR-P01.1 | jose 라이브러리 RS256 | Node.js 네이티브, WebCrypto API 기반, TypeScript 지원 |
| FR-P01.5 | resource:action RBAC | 세분화된 권한 관리, 역할별 권한 매핑 |
| FR-P01.6 | JWT tenantId 클레임 | 토큰 수준 테넌트 격리, 미들웨어에서 자동 검증 |

---

## 1. 서비스 아키텍처

```
auth-service/ (Fastify 5, 포트: 3001)
├── src/
│   ├── index.ts              # 서비스 진입점 (Fastify 인스턴스)
│   ├── handlers/
│   │   ├── login.handler.ts   # POST /auth/login
│   │   ├── logout.handler.ts  # POST /auth/logout
│   │   ├── refresh.handler.ts # POST /auth/refresh
│   │   ├── verify.handler.ts  # GET /auth/verify
│   │   └── mfa.handler.ts    # POST /auth/mfa/setup, /auth/mfa/verify
│   ├── middleware/
│   │   ├── auth.middleware.ts  # JWT 검증 플러그인
│   │   └── rbac.middleware.ts  # RBAC 권한 검사
│   ├── lib/
│   │   ├── jwt.ts             # RS256 토큰 발급/검증
│   │   ├── password.ts        # bcrypt 해시/검증
│   │   ├── session.ts         # 세션 관리 (Redis)
│   │   └── audit.ts           # 감사 로그 연동
│   ├── schemas/
│   │   ├── login.schema.ts    # Zod 검증 스키마
│   │   └── mfa.schema.ts
│   └── routes.ts              # 라우트 등록
├── tests/
│   ├── unit/
│   │   ├── jwt.test.ts
│   │   ├── password.test.ts
│   │   └── rbac.test.ts
│   ├── integration/
│   │   └── auth-flow.test.ts
│   └── csap/
│       ├── d08-session.test.ts
│       └── d08-password.test.ts
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## 2. API 설계

### POST /auth/login
```typescript
// 요청
{
  email: string;      // Zod: z.string().email()
  password: string;   // Zod: z.string().min(8)
  tenantSlug: string; // Zod: z.string().min(1)
  mfaCode?: string;   // Zod: z.string().length(6).optional()
}

// 성공 응답 (200)
{
  success: true,
  data: {
    accessToken: string;  // RS256, 15분 만료
    refreshToken: string; // 7일 만료
    expiresIn: 900;
    user: { id, email, name, role, tenantId }
  }
}

// 실패 응답 (401/423)
{
  success: false,
  error: { code: "AUTH_INVALID_CREDENTIALS" | "AUTH_ACCOUNT_LOCKED", message: string }
}
```

### POST /auth/refresh
```typescript
// 요청
{ refreshToken: string }

// 성공 응답 (200) — Refresh Token Rotation
{
  success: true,
  data: {
    accessToken: string;   // 새 접근 토큰
    refreshToken: string;  // 새 갱신 토큰 (이전 토큰 무효화)
    expiresIn: 900
  }
}
```

### POST /auth/logout
```typescript
// 요청
{ refreshToken: string }

// 동작: 토큰 블랙리스트에 등록 (Redis TTL)
// 응답 (200)
{ success: true, message: "로그아웃 완료" }
```

### GET /auth/verify
```typescript
// Headers: Authorization: Bearer {accessToken}
// 응답 (200): 토큰 페이로드 반환
{ success: true, data: TokenPayload }
```

---

## 3. JWT 구현 설계

```typescript
// lib/jwt.ts
// Design Ref: CSAP D-08-01 인증 관리
import { SignJWT, jwtVerify, importPKCS8, importSPKI } from 'jose';

const ALGORITHM = 'RS256';
const ACCESS_EXPIRES = '15m';  // CSAP D-08
const REFRESH_EXPIRES = '7d';

async function signAccessToken(payload: TokenPayload): Promise<string> {
  const privateKey = await importPKCS8(process.env.JWT_PRIVATE_KEY!, ALGORITHM);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(ACCESS_EXPIRES)
    .setSubject(payload.sub)
    .sign(privateKey);
}

async function verifyAccessToken(token: string): Promise<TokenPayload> {
  const publicKey = await importSPKI(process.env.JWT_PUBLIC_KEY!, ALGORITHM);
  const { payload } = await jwtVerify(token, publicKey);
  return payload as unknown as TokenPayload;
}
```

---

## 4. 세션 관리 설계 (Redis)

```typescript
// lib/session.ts
// CSAP D-08-04: 동시 세션 제한 (최대 3개)

const MAX_SESSIONS = 3;
const SESSION_KEY = (userId: string) => `sessions:${userId}`;
const BLACKLIST_KEY = (token: string) => `blacklist:${token}`;

async function createSession(userId: string, sessionData: SessionData): Promise<void> {
  const sessions = await redis.lrange(SESSION_KEY(userId), 0, -1);
  
  // 동시 세션 제한: 가장 오래된 세션 제거
  if (sessions.length >= MAX_SESSIONS) {
    const oldest = sessions[0];
    if (oldest) {
      await redis.lpop(SESSION_KEY(userId));
      await blacklistToken(JSON.parse(oldest).token);
    }
  }
  
  await redis.rpush(SESSION_KEY(userId), JSON.stringify(sessionData));
}

async function blacklistToken(token: string): Promise<void> {
  // TTL = 남은 만료 시간
  await redis.set(BLACKLIST_KEY(token), '1', 'EX', 900);
}
```

---

## 5. RBAC 설계

```typescript
// middleware/rbac.middleware.ts
// CSAP D-08-05: 권한 관리

// 기본 역할-권한 매핑
const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ['*'],  // 전체 접근
  TENANT_ADMIN: [
    'user:read', 'user:create', 'user:update', 'user:delete',
    'tenant:read', 'tenant:update',
    'menu:read', 'menu:create', 'menu:update', 'menu:delete',
    'subscription:read',
    'audit:read',
  ],
  USER: [
    'user:read:self', 'user:update:self',
    'menu:read',
    'service:read', 'service:use',
  ],
  VIEWER: [
    'user:read:self',
    'menu:read',
    'service:read',
  ],
  AUDITOR: [
    'user:read', 'tenant:read',
    'audit:read', 'audit:export',
    'csap:read', 'compliance:read',
  ],
};
```

---

## 6. 보안 요건 매핑 (CSAP D-08)

| CSAP ID | 항목 | 구현 방법 |
|---------|------|---------|
| D-08-01 | 사용자 인증 | JWT RS256, 15분 만료 |
| D-08-02 | 세션 관리 | Redis 세션 스토어, Refresh Token Rotation |
| D-08-03 | 로그아웃 | 토큰 블랙리스트 (Redis TTL) |
| D-08-04 | 동시 접속 제한 | 최대 3개 세션, FIFO 만료 |
| D-08-05 | 접근 권한 | RBAC (resource:action), 5종 역할 |
| D-08-06 | 계정 잠금 | 5회 실패 → 30분 잠금 |
| D-08-07 | 비밀번호 정책 | 8자+, 대소문자+숫자+특수, bcrypt cost=12 |
| D-08-08 | MFA | TOTP (otpauth:// URI, 6자리 코드) |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 초안 작성 | PM Agent |
