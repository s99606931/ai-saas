---
description: CSAP 중/상 등급 + N2SF 보안체계 준수 규칙. 소스 코드 파일에 적용.
globs: ["src/**/*.{ts,tsx,js,py,go}", "scripts/**/*.{sh,py}"]
---

# CSAP/N2SF 준수 규칙

> CSAP 중/상 등급 79개 통제항목 + N2SF 6개 보안 영역
> ECC common/security 기반 + 공공기관 규제 확장

## D-08: 접근 통제 (12개 항목)

### 필수 구현 패턴

```typescript
// ✅ 모든 API 엔드포인트에 RBAC 검사 필수
export async function GET(req: Request) {
  const user = await verifyToken(req.headers.authorization)
  if (!hasPermission(user, 'resource:read')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  // 비즈니스 로직
}

// ❌ 인증 없는 직접 접근 절대 금지
export async function GET(req: Request) {
  const data = await db.query('SELECT * FROM sensitive_data')
  return Response.json(data)
}
```

### 세션 관리

- JWT 토큰: 접근 15분, 갱신 7일 (만료 필수)
- 로그아웃 시 토큰 블랙리스트 등록
- 동시 세션 제한 (최대 3개)

## D-09: 암호화 (4개 항목)

```typescript
// ✅ 민감 데이터 암호화 (AES-256)
import { encrypt, decrypt } from '@/lib/crypto'
const encryptedData = await encrypt(sensitiveData, process.env.ENCRYPTION_KEY)

// ✅ 해시: bcrypt (비밀번호), SHA-256 (일반 데이터)
const hashedPassword = await bcrypt.hash(password, 12)

// ❌ 평문 저장 절대 금지
const user = await db.create({ password: plainPassword })  // BLOCKED

// ❌ 하드코딩 시크릿 절대 금지
const apiKey = 'sk-1234567890abcdef'  // BLOCKED
```

**전송 암호화**: TLS 1.3+ 필수. HTTP 직접 통신 금지.

## D-06: 침해사고 관리 (5개 항목) — 감사 로깅

```typescript
// ✅ 모든 민감 작업 감사 로그 필수
import { auditLog } from '@/lib/audit'

async function deleteUser(adminUser: User, targetUserId: string) {
  await auditLog({
    actor: adminUser.id,
    action: 'USER_DELETE',
    target: targetUserId,
    timestamp: new Date().toISOString(),
    ip: getClientIP(),
  })
  await db.users.delete(targetUserId)
}
```

**로그 보존**: 최소 1년 (CSAP D-06 요건)
**로그 무결성**: 수정/삭제 불가 구조 (append-only)

## D-12: 시스템 개발 보안 (10개 항목)

### 입력 검증 (SQL 주입, XSS 방지)

```typescript
// ✅ Zod 스키마 검증 필수 (모든 API 입력)
import { z } from 'zod'

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(['admin', 'user', 'viewer']),
})

export async function POST(req: Request) {
  const body = await req.json()
  const validated = createUserSchema.parse(body)  // 검증 실패 시 400 자동
  // ...
}

// ✅ 매개변수화 쿼리 필수
const user = await db.execute(
  'SELECT * FROM users WHERE email = $1',
  [email]  // 직접 문자열 결합 절대 금지
)

// ❌ SQL 직접 결합 절대 금지
const user = await db.execute(`SELECT * FROM users WHERE email = '${email}'`)  // BLOCKED
```

### HTML 새니타이제이션 (XSS 방지)

```typescript
import DOMPurify from 'dompurify'
const safe = DOMPurify.sanitize(userInput)
```

## N2SF AI 연동 데이터 분류 규칙

```typescript
// AI API 전송 전 데이터 등급 확인 필수
enum DataGrade { C = 'C', S = 'S', O = 'O' }

async function sendToAI(data: any, grade: DataGrade): Promise<AIResponse> {
  // C, S 등급: AI API 전송 절대 금지
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }

  // O 등급: PII 마스킹 후 전송
  const masked = await maskPII(data)
  return aiGateway.send(masked)
}
```

## 공통 보안 금지사항

```typescript
// ❌ 하드코딩된 시크릿
const SECRET = 'my-secret-key'  // BLOCKED

// ✅ 환경 변수 사용
const SECRET = process.env.SECRET_KEY
if (!SECRET) throw new Error('SECRET_KEY 환경 변수 누락')

// ❌ 에러 메시지에 민감 정보 노출
catch (e) {
  return { error: e.message, stack: e.stack, dbPassword: process.env.DB_PASS }  // BLOCKED
}

// ✅ 안전한 에러 응답
catch (e) {
  logger.error('Internal error', { errorId: uuid() })
  return { error: 'Internal server error', errorId: uuid() }
}
```
