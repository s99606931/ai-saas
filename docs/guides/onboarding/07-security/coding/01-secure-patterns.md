# 보안 코딩 패턴 — NG vs OK 대조 예시

> **버전**: 1.0.0 | **작성일**: 2026-04-11
> **대상**: TypeScript/Node.js로 코드를 작성하는 개발자
> **전제 조건**: `csap/01-what-is-csap.md` 학습 완료
> **소요 시간**: 약 90분
> **CSAP**: D-08, D-09, D-12

---

## 목차

1. [인증/인가 패턴](#1-인증인가-패턴)
2. [Zod 스키마 검증 패턴](#2-zod-스키마-검증-패턴)
3. [SQL 주입 방지 패턴](#3-sql-주입-방지-패턴)
4. [XSS 방지 패턴](#4-xss-방지-패턴)
5. [시크릿 관리 패턴](#5-시크릿-관리-패턴)
6. [암호화 패턴](#6-암호화-패턴)
7. [에러 처리 패턴](#7-에러-처리-패턴)
8. [N2SF AI 연동 패턴](#8-n2sf-ai-연동-패턴)

---

## 1. 인증/인가 패턴

### 1.1 JWT 토큰 검증 미들웨어

```typescript
// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { tokenBlacklist } from '../lib/token-blacklist';
import { logger } from '../lib/logger';

// Design Ref: §D-08 접근 통제
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: string;
    tenantId: string;
    permissions: string[];
  };
}

// ❌ NG: 토큰을 검증하지 않거나 만료를 무시
async function badAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  const decoded = jwt.decode(token!);  // decode는 서명 검증을 하지 않음!
  (req as any).user = decoded;
  next();
}

// ✅ OK: 서명 검증 + 만료 확인 + 블랙리스트 확인
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. 토큰 추출
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing authentication token' });
      return;
    }
    const token = authorization.split(' ')[1];

    // 2. 서명 검증 + 만료 확인 (jwt.verify는 두 가지를 동시에 검사)
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET 환경 변수 누락');

    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'public-saas-auth',
    }) as jwt.JwtPayload;

    // 3. 블랙리스트 확인 (로그아웃된 토큰)
    if (await tokenBlacklist.isBlacklisted(token)) {
      res.status(401).json({ error: 'Token has been revoked' });
      return;
    }

    // 4. 요청에 사용자 정보 첨부
    req.user = {
      id: decoded.sub!,
      email: decoded.email,
      role: decoded.role,
      tenantId: decoded.tenantId,
      permissions: decoded.permissions ?? [],
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
    } else {
      logger.error({ error }, 'Auth middleware error');
      res.status(500).json({ error: 'Authentication error' });
    }
  }
}
```

### 1.2 RBAC 권한 검사

```typescript
// src/lib/permissions.ts
// Design Ref: §D-08 접근 통제 — 역할 기반 접근 제어

// ❌ NG: 역할 이름만 확인 (역할이 많아지면 관리 어려움)
function badPermissionCheck(userRole: string, requiredRole: string): boolean {
  return userRole === requiredRole;  // 'admin'인지만 확인
}

// ✅ OK: 세분화된 권한 기반 검사
const ROLE_PERMISSIONS: Record<string, string[]> = {
  'admin': [
    'users:list', 'users:read', 'users:create', 'users:update', 'users:delete',
    'tenants:manage', 'audit:read', 'reports:export',
  ],
  'editor': [
    'users:list', 'users:read', 'users:create', 'users:update',
    'reports:read',
  ],
  'viewer': [
    'users:list', 'users:read',
    'reports:read',
  ],
};

export function hasPermission(
  user: { role: string; permissions: string[] },
  requiredPermission: string
): boolean {
  // 사용자 직접 권한 확인
  if (user.permissions.includes(requiredPermission)) return true;

  // 역할 기반 권한 확인
  const rolePermissions = ROLE_PERMISSIONS[user.role] ?? [];
  return rolePermissions.includes(requiredPermission);
}

// 라우터에서 사용
export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!hasPermission(req.user, permission)) {
      res.status(403).json({
        error: 'Forbidden',
        required: permission,
        // 현재 사용자 권한 노출 금지 (공격자에게 정보 제공)
      });
      return;
    }
    next();
  };
}
```

```typescript
// src/routes/users.router.ts
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../lib/permissions';

const router = express.Router();

// ❌ NG: 인증 없는 라우터
router.get('/users', async (req, res) => {
  const users = await db.users.findMany();
  res.json(users);
});

// ✅ OK: 인증 + 권한 검사
router.get('/users',
  authMiddleware,                          // 인증 (D-08)
  requirePermission('users:list'),         // 권한 (D-08)
  async (req: AuthenticatedRequest, res: Response) => {
    // 테넌트 격리 (자기 테넌트 데이터만 조회)
    const users = await db.users.findMany({
      where: { tenantId: req.user.tenantId },
    });
    res.json({ users });
  }
);

// 삭제는 더 높은 권한 필요
router.delete('/users/:id',
  authMiddleware,
  requirePermission('users:delete'),
  async (req: AuthenticatedRequest, res: Response) => {
    // ... 삭제 로직 (auditLog 포함)
  }
);
```

---

## 2. Zod 스키마 검증 패턴

### 2.1 기본 요청 검증

```typescript
// src/schemas/user.schema.ts
import { z } from 'zod';

// Design Ref: §D-12 시스템 개발 보안 — 입력 검증

// ❌ NG: 검증 없이 바로 사용
async function createUserBad(req: Request) {
  const { email, name, role } = req.body;
  // name에 SQL 주입 문자열이 들어올 수 있음
  // role에 존재하지 않는 역할이 들어올 수 있음
  const user = await db.users.create({ data: { email, name, role } });
  return user;
}

// ✅ OK: Zod 스키마로 엄격 검증
export const createUserSchema = z.object({
  email: z
    .string({ required_error: '이메일은 필수입니다' })
    .email('유효한 이메일 형식이 아닙니다')
    .max(255, '이메일이 너무 깁니다')
    .transform(email => email.toLowerCase()),  // 정규화

  name: z
    .string({ required_error: '이름은 필수입니다' })
    .min(1, '이름은 최소 1자 이상이어야 합니다')
    .max(100, '이름은 최대 100자입니다')
    .regex(/^[가-힣a-zA-Z\s\-\.]+$/, '이름에 허용되지 않는 문자가 있습니다'),

  role: z.enum(['admin', 'editor', 'viewer'], {
    errorMap: () => ({ message: 'role은 admin, editor, viewer 중 하나여야 합니다' }),
  }),

  phoneNumber: z
    .string()
    .regex(/^010-\d{4}-\d{4}$/, '전화번호 형식: 010-0000-0000')
    .optional(),
});

// 타입 추론
export type CreateUserInput = z.infer<typeof createUserSchema>;

// 라우터에서 사용
async function createUserGood(req: Request, res: Response) {
  const result = createUserSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const user = await db.users.create({ data: result.data });
  return res.status(201).json({ user });
}
```

### 2.2 쿼리 파라미터 검증

```typescript
// src/schemas/query.schema.ts

// ❌ NG: 쿼리 파라미터 무검증 사용
async function listUsersBad(req: Request, res: Response) {
  const page = req.query.page;  // string | undefined
  const limit = req.query.limit; // string | undefined
  // parseInt('abc') = NaN → DB 쿼리 오류!
  const users = await db.users.findMany({
    skip: (parseInt(page as string) - 1) * parseInt(limit as string),
    take: parseInt(limit as string),
  });
}

// ✅ OK: 쿼리 파라미터 검증 + 기본값 + 최대값 제한
export const paginationSchema = z.object({
  page: z
    .string()
    .default('1')
    .transform(v => parseInt(v, 10))
    .pipe(z.number().int().min(1, '페이지는 1 이상이어야 합니다')),

  limit: z
    .string()
    .default('20')
    .transform(v => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(100, '최대 100개까지 조회 가능합니다')),

  search: z
    .string()
    .max(100, '검색어는 최대 100자입니다')
    .optional(),
});

async function listUsersGood(req: Request, res: Response) {
  const result = paginationSchema.safeParse(req.query);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid query parameters' });
  }

  const { page, limit, search } = result.data;
  const users = await db.users.findMany({
    skip: (page - 1) * limit,
    take: limit,
    where: search ? { name: { contains: search } } : undefined,
  });
  return res.json({ users, page, limit });
}
```

---

## 3. SQL 주입 방지 패턴

### 3.1 ORM 사용 (Prisma)

```typescript
// Design Ref: §D-12 — SQL 주입 방지

// ❌ NG: 원시 SQL에 직접 문자열 결합
async function findUserByEmailBad(email: string) {
  // email = "'; DROP TABLE users; --" 이면 재앙!
  const query = `SELECT * FROM users WHERE email = '${email}'`;
  return await db.$queryRawUnsafe(query);
}

// ✅ OK-1: Prisma ORM 사용 (자동 파라미터화)
async function findUserByEmail(email: string) {
  return await db.users.findFirst({
    where: { email },  // Prisma가 자동으로 파라미터화
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      // password 필드 제외 (필요 없는 데이터는 조회하지 않음)
    },
  });
}

// ✅ OK-2: 필요 시 Raw Query — 반드시 파라미터화
async function searchUsersByNameRaw(name: string, tenantId: string) {
  // $1, $2 플레이스홀더 사용 (절대 문자열 결합 금지)
  return await db.$queryRaw<User[]>`
    SELECT id, name, email
    FROM users
    WHERE name ILIKE ${'%' + name + '%'}
      AND tenant_id = ${tenantId}
    ORDER BY name
    LIMIT 50
  `;
  // 또는 Prisma.sql 태그 사용
}
```

### 3.2 복잡한 검색 조건 처리

```typescript
// ❌ NG: 동적 SQL 조건 문자열 결합
function buildSearchQuery(filters: Record<string, string>) {
  let query = 'SELECT * FROM users WHERE 1=1';
  for (const [key, value] of Object.entries(filters)) {
    query += ` AND ${key} = '${value}'`;  // key도 주입 가능!
  }
  return query;
}

// ✅ OK: 허용된 필드만 명시적으로 처리
async function searchUsers(filters: {
  name?: string;
  email?: string;
  role?: 'admin' | 'editor' | 'viewer';
  tenantId: string;
}) {
  const where: Prisma.UsersWhereInput = {
    tenantId: filters.tenantId,  // 반드시 테넌트 격리
  };

  // 허용된 필드만 조건 추가
  if (filters.name) {
    where.name = { contains: filters.name, mode: 'insensitive' };
  }
  if (filters.email) {
    where.email = { equals: filters.email.toLowerCase() };
  }
  if (filters.role) {
    where.role = filters.role;  // enum으로 제한됨
  }

  return await db.users.findMany({ where, take: 100 });
}
```

---

## 4. XSS 방지 패턴

### 4.1 서버 사이드 XSS 방지

```typescript
// Design Ref: §D-12 — XSS 방지

// ❌ NG: 사용자 입력을 HTML에 직접 삽입
function renderUserProfile(userInput: string): string {
  return `<div class="profile">${userInput}</div>`;
  // userInput = "<script>alert('XSS')</script>" 이면 공격 성공!
}

// ✅ OK: HTML 이스케이프
import he from 'he';  // HTML entities 라이브러리

function renderUserProfileSafe(userInput: string): string {
  const escaped = he.encode(userInput);
  return `<div class="profile">${escaped}</div>`;
}

// 또는 React/Vue 등 프레임워크의 자동 이스케이프 사용
// React: {userInput}  → 자동으로 이스케이프됨
// React: dangerouslySetInnerHTML={{ __html: userInput }}  → ❌ 절대 금지
```

### 4.2 Rich Text (HTML 허용) 처리

```typescript
// 사용자가 HTML을 입력해야 하는 경우 (게시판 본문 등)
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = DOMPurify(window);

// ❌ NG: 사용자 HTML 그대로 사용
function saveArticle(htmlContent: string) {
  return db.articles.create({ data: { content: htmlContent } });
}

// ✅ OK: DOMPurify로 위험한 태그/속성 제거
function saveArticleSafe(htmlContent: string) {
  const sanitized = purify.sanitize(htmlContent, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3'],
    ALLOWED_ATTR: ['href', 'target'],
    ALLOW_DATA_ATTR: false,
    FORBID_SCRIPTS: true,
    FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input'],
  });
  return db.articles.create({ data: { content: sanitized } });
}
```

### 4.3 Content-Security-Policy 헤더

```typescript
// src/middleware/security-headers.middleware.ts
import helmet from 'helmet';

// ✅ OK: CSP 헤더로 XSS 공격 추가 방어층
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],           // 외부 스크립트 금지
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],           // object, embed 금지
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],            // iframe 금지
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,  // 1년 (TLS 강제)
    includeSubDomains: true,
    preload: true,
  },
}));
```

---

## 5. 시크릿 관리 패턴

### 5.1 환경 변수 안전하게 로드

```typescript
// src/config/secrets.ts
// Design Ref: §D-09 암호화 — 시크릿 관리

// ❌ NG: 하드코딩
const config = {
  jwtSecret: 'my-super-secret-jwt-key-2026',
  dbPassword: 'postgres-password-123',
  aiApiKey: 'sk-proj-abc123def456',
};

// ❌ NG: 환경 변수 존재 확인 없이 사용
const jwtSecret = process.env.JWT_SECRET;  // undefined일 수 있음
jwt.verify(token, jwtSecret!);  // ! 단언으로 오류 숨김

// ✅ OK: 시작 시 모든 필수 환경 변수 검증
function loadRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `필수 환경 변수 '${key}'가 설정되지 않았습니다. ` +
      `배포 설정을 확인하십시오.`
    );
  }
  return value;
}

export const config = {
  jwt: {
    secret: loadRequiredEnv('JWT_SECRET'),
    accessExpiry: process.env.JWT_ACCESS_EXPIRY ?? '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? '7d',
  },
  database: {
    url: loadRequiredEnv('DATABASE_URL'),
    poolSize: parseInt(process.env.DB_POOL_SIZE ?? '10', 10),
  },
  encryption: {
    key: loadRequiredEnv('ENCRYPTION_KEY'),
    algorithm: 'aes-256-gcm' as const,
  },
  // AI Gateway (직접 외부 AI API 키 금지)
  aiGateway: {
    url: loadRequiredEnv('AI_GATEWAY_URL'),
    key: loadRequiredEnv('AI_GATEWAY_KEY'),
  },
} as const;

// 모듈 로드 시점에 검증 실행 (애플리케이션 시작 시 즉시 실패)
// → undefined 환경 변수로 인한 런타임 오류 방지
```

### 5.2 Kubernetes Sealed Secret 사용

```bash
# 시크릿 생성 (일반 텍스트로 절대 커밋 금지)

# ❌ NG: 평문 Secret 커밋
# k8s/secrets/auth-service-secrets.yaml
apiVersion: v1
kind: Secret
data:
  JWT_SECRET: bXktc2VjcmV0  # base64 → 누구나 디코딩 가능!

# ✅ OK: Sealed Secret 사용 (암호화 후 커밋 가능)
# 1. 일반 시크릿 파일 생성 (로컬에서만)
kubectl create secret generic auth-service-secrets \
  --from-literal=JWT_SECRET="$(openssl rand -hex 32)" \
  --from-literal=ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  --dry-run=client -o yaml > /tmp/secret.yaml

# 2. Sealed Secret으로 암호화
kubeseal --controller-name=sealed-secrets \
  --controller-namespace=kube-system \
  < /tmp/secret.yaml > k8s/secrets/auth-service-sealed.yaml

# 3. 암호화된 파일만 커밋 (평문 파일 삭제)
rm /tmp/secret.yaml
git add k8s/secrets/auth-service-sealed.yaml
```

---

## 6. 암호화 패턴

### 6.1 민감 데이터 저장 암호화

```typescript
// src/lib/crypto.ts
// Design Ref: §D-09 암호화 — AES-256-GCM
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;  // GCM 권장 IV 길이
const TAG_LENGTH = 16; // GCM 인증 태그 길이

// 키는 반드시 환경 변수에서 로드 (32바이트 = 256비트)
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY 환경 변수 누락');
  return Buffer.from(key, 'hex');
}

// ❌ NG: 평문 저장
async function saveSSNBad(userId: string, ssn: string) {
  await db.users.update({
    where: { id: userId },
    data: { ssn },  // 평문 저장!
  });
}

// ✅ OK: AES-256-GCM 암호화 후 저장
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // IV + 태그 + 암호문을 base64로 인코딩
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const buffer = Buffer.from(ciphertext, 'base64');

  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8');
}

// 사용 예시
async function saveSSNSafe(userId: string, ssn: string) {
  const encryptedSSN = encrypt(ssn);
  await db.users.update({
    where: { id: userId },
    data: { ssnEncrypted: encryptedSSN },  // 암호화된 값만 저장
  });
}
```

### 6.2 비밀번호 해시

```typescript
// src/lib/password.ts
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;  // CSAP D-09: 최소 12 이상

// ❌ NG: 평문 저장 또는 약한 해시
function hashPasswordBad(password: string): string {
  return Buffer.from(password).toString('base64');  // 단순 인코딩 = 복호화 가능!
  // 또는
  return require('crypto').createHash('md5').update(password).digest('hex');  // MD5 = 취약!
}

// ✅ OK: bcrypt로 단방향 해시
export async function hashPassword(password: string): Promise<string> {
  // 비밀번호 복잡도 검증
  if (password.length < 8) {
    throw new Error('비밀번호는 최소 8자 이상이어야 합니다');
  }
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}
```

---

## 7. 에러 처리 패턴

### 7.1 안전한 에러 응답

```typescript
// src/middleware/error.middleware.ts
// Design Ref: §D-09 — 민감 정보 에러 메시지 노출 금지
import { randomUUID } from 'crypto';
import { logger } from '../lib/logger';

// ❌ NG: 내부 정보 노출
function badErrorHandler(error: Error, req: Request, res: Response) {
  res.status(500).json({
    error: error.message,          // DB 연결 문자열 포함 가능
    stack: error.stack,            // 파일 경로, 라인 번호 노출
    env: process.env,              // 모든 환경 변수 노출!!!
  });
}

// ✅ OK: 최소 정보만 반환
export function globalErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // 에러 추적을 위한 고유 ID 생성
  const errorId = randomUUID();

  // 내부적으로 상세 로그 (운영팀만 접근 가능)
  logger.error({
    errorId,
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    userId: (req as AuthenticatedRequest).user?.id ?? 'anonymous',
    tenantId: (req as AuthenticatedRequest).user?.tenantId ?? 'none',
    // 절대 포함 금지: 환경 변수, DB 연결 정보, API 키
  }, 'Unhandled error');

  // 알려진 에러 유형은 적절한 상태 코드 반환
  if (error.name === 'ValidationError') {
    res.status(400).json({ error: 'Invalid input', errorId });
    return;
  }

  if (error.name === 'NotFoundError') {
    res.status(404).json({ error: 'Resource not found', errorId });
    return;
  }

  // 알 수 없는 에러는 500
  res.status(500).json({
    error: 'Internal server error',
    errorId,
    // 절대 포함 금지: error.message, error.stack, 환경 변수
  });
}
```

---

## 8. N2SF AI 연동 패턴

### 8.1 데이터 등급 확인 후 AI 호출

```typescript
// src/lib/ai-gateway.ts
// Design Ref: §N2SF AI 연동 — C/S 등급 데이터 전송 절대 금지
// Plan SC: AI-REQ-1

enum DataGrade {
  C = 'C',  // 대외비 (Confidential) — AI API 전송 절대 금지
  S = 'S',  // 민감 (Sensitive) — AI API 전송 절대 금지
  O = 'O',  // 공개 (Open) — PII 마스킹 후 허용
}

// PII 마스킹 패턴
const PII_PATTERNS = [
  { pattern: /\d{6}-[1-4]\d{6}/, replacement: '******-*******' },  // 주민등록번호
  { pattern: /01[0-9]-\d{3,4}-\d{4}/, replacement: '***-****-****' },  // 전화번호
  { pattern: /[가-힣]{2,4}(?=\s|$)/g, replacement: '***' },  // 이름 (휴리스틱)
];

function maskPII(text: string): string {
  let masked = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    masked = masked.replace(pattern, replacement);
  }
  return masked;
}

// ❌ NG: 데이터 등급 확인 없이 AI API 직접 호출
async function callAIBad(sensitiveData: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_KEY}` },
    body: JSON.stringify({ messages: [{ role: 'user', content: sensitiveData }] }),
  });
  return response.json();
}

// ✅ OK: 등급 확인 + PII 마스킹 + AI Gateway 경유
export async function callAIGateway(
  data: string,
  grade: DataGrade,
  metadata: { tenantId: string; userId: string; purpose: string }
): Promise<{ result: string; requestId: string }> {
  // 1. C/S 등급 데이터 전송 절대 차단
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(
      `[N2SF 위반] ${grade}등급 데이터는 AI API 전송이 금지되어 있습니다. ` +
      `(N2SF N-05: 중요 정보 외부 전송 통제)`
    );
  }

  // 2. O 등급: PII 마스킹 처리
  const maskedData = maskPII(data);

  // 3. AI Gateway 경유 (외부 직접 호출 절대 금지)
  const gatewayUrl = process.env.AI_GATEWAY_URL;
  if (!gatewayUrl) throw new Error('AI_GATEWAY_URL 환경 변수 누락');

  const response = await fetch(`${gatewayUrl}/v1/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.AI_GATEWAY_KEY}`,
      'X-Tenant-ID': metadata.tenantId,
      'X-User-ID': metadata.userId,
      'X-Purpose': metadata.purpose,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content: maskedData }),
  });

  if (!response.ok) {
    throw new Error(`AI Gateway 오류: ${response.status}`);
  }

  return response.json();
}
```

---

## 보안 코딩 패턴 요약표

| 취약점 | 핵심 방어 패턴 | CSAP 항목 |
|--------|------------|---------|
| 미인증 API | authMiddleware + requirePermission() | D-08 |
| SQL 주입 | Prisma ORM 또는 파라미터화 쿼리 | D-12 |
| XSS | he.encode() + DOMPurify + CSP 헤더 | D-12 |
| 하드코딩 시크릿 | process.env + loadRequiredEnv() | D-09 |
| 평문 비밀번호 | bcrypt.hash(password, 12) | D-09 |
| 민감 데이터 평문 저장 | encrypt() — AES-256-GCM | D-09 |
| 에러 메시지 노출 | errorId만 반환, 로그는 내부 기록 | D-09 |
| 미검증 입력 | Zod 스키마로 safeParse() | D-12 |
| AI API 무단 전송 | 등급 확인 + PII 마스킹 + Gateway | N2SF |

---

## 다음 단계

보안 코딩 패턴을 배웠습니다. 마지막으로 감사 로그를 올바르게 작성하는 방법을 학습합니다.

`../audit/01-audit-logging.md`로 이동하십시오.

---

> **참조**: `.claude/rules/csap-compliance.md` — CSAP 코드 규칙 전문
> **참조**: `platform/services/security-service/src/lib/audit.ts` — 감사 로깅 구현체
> **CSAP 연관**: D-08 (접근 통제), D-09 (암호화), D-12 (시스템 개발 보안)
