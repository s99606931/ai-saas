# 코딩 스타일 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | DEV-CODESTYLE |
| 버전 | 0.1.0 |
| 최종 수정일 | 2026-04-05 |
| 대상 | 개발자 전원 |
| 근거 | CLAUDE.md, `.claude/rules/harness-constraints.md`, `.claude/rules/csap-compliance.md` |
| FR 매핑 | FR-0.6 (코딩 스타일 부문) |

<!-- Design Ref: MTU-F3-dev-standards.design.md 2.3절 -- 코딩 스타일 가이드 설계 -->

---

## 목적

프레임워크의 코드 품질과 보안을 보장하기 위한 코딩 규칙을 정의합니다. CLAUDE.md 절대 제약, ECC harness-constraints, CSAP 보안 규칙을 통합하여 단일 참조 문서로 제공합니다.

---

## 1. 기본 코딩 규칙

### 1.1 들여쓰기 및 포매팅

| 항목 | TypeScript/JavaScript | Python |
|------|---------------------|--------|
| 들여쓰기 | 2칸 (스페이스) | 4칸 (스페이스) |
| 줄 길이 | 120자 이하 | 120자 이하 |
| 세미콜론 | 사용 | N/A |
| 따옴표 | 작은따옴표 (') | 작은따옴표 (') |

### 1.2 네이밍 규칙

| 대상 | TypeScript | Python | 규칙 |
|------|-----------|--------|------|
| 변수 | `camelCase` | `snake_case` | 약어 금지, 의미 명확 |
| 함수 | `camelCase` | `snake_case` | 동사로 시작 |
| 클래스 | `PascalCase` | `PascalCase` | 명사 |
| 상수 | `UPPER_SNAKE_CASE` | `UPPER_SNAKE_CASE` | 의미 명확 |
| 파일 | `kebab-case.ts` | `snake_case.py` | 기능 반영 |
| 인터페이스 | `PascalCase` (I 접두사 미사용) | — | 명사 |
| 타입 | `PascalCase` | — | 명사 |

**금지 패턴**:
- 단일 문자 변수: `x`, `y`, `a` (루프 카운터 `i`, `j`, `k` 예외)
- 의미 없는 접두사: `data1`, `temp2`, `obj3`
- 약어: `btn`, `msg`, `req` (풀 스펠링 사용: `button`, `message`, `request`)

### 1.3 함수 규칙

| 규칙 | 기준 | 위반 시 조치 |
|------|------|-----------|
| 함수 크기 | **80줄 이하** | 분리 필수 |
| 매개변수 수 | **4개 이하** | 객체 매개변수로 변환 |
| 중첩 깊이 | **4단계 이하** | early return 또는 함수 추출 |
| 단일 책임 | 하나의 기능만 수행 | 분리 필수 |

```typescript
// 좋은 예: 단일 책임, 명확한 이름
async function validateUserInput(input: CreateUserInput): Promise<ValidationResult> {
  const schema = createUserSchema.parse(input)
  return { isValid: true, data: schema }
}

// 나쁜 예: 다중 책임, 80줄 초과 위험
async function processUser(data: any) {
  // 검증 + 저장 + 알림 + 로깅을 모두 수행 -- 분리 필요
}
```

### 1.4 파일 크기

| 규칙 | 기준 |
|------|------|
| 파일 크기 | **800줄 이하** |
| 초과 시 | 모듈 분리 검토, 관련 기능 별도 파일로 추출 |

---

## 2. Dead Code 금지 규칙

> 근거: `.claude/rules/deadcode-policy.md`

### 즉시 제거 대상

| 코드 유형 | 처리 | 기한 |
|---------|------|------|
| 미사용 함수 | 즉시 제거 | 발견 즉시 |
| 미사용 변수 | 즉시 제거 | 발견 즉시 |
| 미사용 import | 즉시 제거 | 발견 즉시 |
| 미사용 CSS 클래스 | 즉시 제거 | 발견 즉시 |
| 주석 처리된 코드 | 제거 (git 히스토리 보존) | 발견 즉시 |
| 미사용 npm 패키지 | `package.json`에서 제거 | 발견 즉시 |

### 예외 (제거 금지)

```typescript
// 예외 1: 공개 API (deprecation 정책 적용 중)
/**
 * @deprecated v2.0에서 제거 예정. v1.x 호환성 유지.
 * @see newFunction
 */
export function oldPublicApi() { /* ... */ }

// 예외 2: 미래 Phase 사용 예정 (명시적 주석 필수)
// NOTE: 미사용. Phase 2 FR-2.3 구현 시 사용 예정. 2026-07-01 이후 재검토.
function csapStandardGradeValidator() { /* ... */ }

// 예외 3: 테스트 fixture
export const mockCsapChecklist = { /* ... */ }  // tests/fixtures/

// 예외 4: 마이그레이션 스크립트
export async function migrateToV2() { /* ... */ }  // migrations/
```

---

## 3. CSAP D-12 보안 패턴 (입력 검증)

> 근거: `.claude/rules/csap-compliance.md` D-12 섹션

### 3.1 Zod 스키마 검증 (필수)

모든 API 입력에 Zod 스키마 검증을 적용합니다.

```typescript
import { z } from 'zod'

// 스키마 정의
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(['admin', 'user', 'viewer']),
})

// API 핸들러에서 검증
export async function POST(request: Request) {
  const body = await request.json()
  const validated = createUserSchema.parse(body)  // 검증 실패 시 400 자동
  // 검증된 데이터로 비즈니스 로직 수행
}
```

### 3.2 매개변수화 쿼리 (필수)

SQL 인젝션 방지를 위해 매개변수화 쿼리를 사용합니다.

```typescript
// 올바른 방법: 매개변수화 쿼리
const user = await database.execute(
  'SELECT * FROM users WHERE email = $1',
  [email]
)

// 금지: SQL 직접 결합 -- 절대 사용 금지
const user = await database.execute(
  `SELECT * FROM users WHERE email = '${email}'`  // 취약점!
)
```

### 3.3 HTML 새니타이제이션 (XSS 방지)

```typescript
import DOMPurify from 'dompurify'

// 사용자 입력을 DOM에 삽입하기 전 반드시 새니타이즈
const safeHtml = DOMPurify.sanitize(userInput)
```

---

## 4. CSAP D-06 감사 로그 패턴

> 근거: `.claude/rules/csap-compliance.md` D-06 섹션

### 민감 작업 감사 로그 기록 (필수)

```typescript
import { auditLog } from '@/lib/audit'

async function deleteUser(adminUser: User, targetUserId: string) {
  // 감사 로그 먼저 기록
  await auditLog({
    actor: adminUser.id,
    action: 'USER_DELETE',
    target: targetUserId,
    timestamp: new Date().toISOString(),
    ip: getClientIP(),
  })
  
  // 이후 비즈니스 로직 수행
  await database.users.delete(targetUserId)
}
```

**감사 로그 필수 기록 대상**:
- 사용자 생성/수정/삭제
- 권한 변경
- 데이터 조회 (민감 데이터)
- 시스템 설정 변경
- 인증 시도 (성공/실패)
- AI API 호출

---

## 5. CSAP D-09 암호화 패턴

> 근거: `.claude/rules/csap-compliance.md` D-09 섹션

### 5.1 데이터 저장 암호화

```typescript
import { encrypt, decrypt } from '@/lib/crypto'

// 민감 데이터 저장 시 AES-256 암호화
const encryptedData = await encrypt(sensitiveData, process.env.ENCRYPTION_KEY)
```

### 5.2 비밀번호 해시

```typescript
import bcrypt from 'bcrypt'

// 비밀번호 저장 시 bcrypt 해시 (12 라운드)
const hashedPassword = await bcrypt.hash(password, 12)

// 비밀번호 검증
const isValid = await bcrypt.compare(inputPassword, hashedPassword)
```

### 5.3 전송 암호화

- **TLS 1.3+** 필수 (HTTP 평문 통신 금지)
- JWT 토큰: 접근 15분 만료, 갱신 7일 만료

---

## 6. 하드코딩 시크릿 금지

```typescript
// 금지: 하드코딩된 시크릿
const SECRET = 'my-secret-key'           // 절대 금지!
const API_KEY = 'sk-1234567890abcdef'    // 절대 금지!

// 올바른 방법: 환경변수 사용
const SECRET = process.env.SECRET_KEY
if (!SECRET) {
  throw new Error('SECRET_KEY 환경 변수가 설정되지 않았습니다')
}
```

**금지 파일 커밋**:
- `.env`, `.env.local`, `.env.production`
- `secrets.*`, `*credential*`
- 개인 키 파일 (`.pem`, `.key`)

---

## 7. 안전한 에러 처리

```typescript
// 금지: 에러에 민감 정보 포함
catch (error) {
  return { error: error.message, stack: error.stack }  // 내부 정보 노출!
}

// 올바른 방법: 안전한 에러 응답
catch (error) {
  const errorId = generateUuid()
  logger.error('Internal error', { errorId, error })  // 내부 로그에만 기록
  return { error: '서버 내부 오류가 발생했습니다', errorId }  // 사용자에게는 최소 정보만
}
```

---

## 8. 주석 규칙

| 규칙 | 설명 |
|------|------|
| **왜(WHY)**를 설명 | 자명한 코드에 "무엇을 하는지" 주석 금지 |
| Design 참조 주석 | 핵심 설계 결정에 `// Design Ref: §X -- 이유` 추가 |
| Plan SC 주석 | 수용 기준 대응에 `// Plan SC: FR-X.Y` 추가 |
| TODO 규칙 | 3개월 초과 TODO는 이슈로 전환 후 제거 |

---

## 9. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 -- 기본 규칙 + CSAP D-06/D-09/D-12 보안 패턴 + Dead code 정책 | Claude Code (PM Lead) |
