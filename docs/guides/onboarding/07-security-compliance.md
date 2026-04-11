# 7장: 보안 및 컴플라이언스 완전 가이드

> 공공기관 SaaS 프레임워크 신규 직원 온보딩 가이드북
> 버전: 1.0.0 | 작성일: 2026-04-11 | 대상: 전체 개발 직원
> 참조: `.claude/rules/csap-compliance.md`

---

## 목차

1. [보안 프레임워크 개요](#1-보안-프레임워크-개요)
2. [코드 레벨 보안 규칙](#2-코드-레벨-보안-규칙)
3. [N2SF 데이터 등급 분류](#3-n2sf-데이터-등급-분류)
4. [감사 로그 작성법](#4-감사-로그-작성법)
5. [환경 변수 및 시크릿 관리](#5-환경-변수-및-시크릿-관리)
6. [CSAP 증거 수집 자동화](#6-csap-증거-수집-자동화)
7. [보안 검사 도구](#7-보안-검사-도구)
8. [보안 사고 대응](#8-보안-사고-대응)
9. [체크리스트: PR 제출 전 보안 점검](#9-체크리스트-pr-제출-전-보안-점검)

---

## 1. 보안 프레임워크 개요

### 1.1 세 가지 규제 체계

공공기관 SaaS 프레임워크는 세 가지 규제 체계를 동시에 준수합니다. 각 체계의 역할을 이해하면 "왜 이렇게 해야 하는가"에 대한 답을 얻을 수 있습니다.

```
CSAP (클라우드 보안인증)
  └── 목적: 공공기관 클라우드 서비스 도입 시 보안 신뢰도 인증
  └── 근거: 과학기술정보통신부 고시
  └── 범위: 79개 통제항목 (중등급 기준)
  └── 담당: 13개 보안 영역 D-01~D-13

ISMS-P (정보보호 및 개인정보보호 관리체계)
  └── 목적: 개인정보를 처리하는 기관의 종합 보안 관리체계
  └── 근거: 정보통신망법 + 개인정보보호법
  └── 범위: 7개 섹션, 102개 통제항목
  └── 중점: 개인정보 수집·이용·파기 전 과정

N2SF (국가 클라우드 보안프레임워크)
  └── 목적: 공공기관 클라우드 서비스의 데이터 보호 등급 분류
  └── 근거: 국가정보원 고시
  └── 범위: 6개 보안 영역, 데이터 등급별 요건
  └── 핵심: C/S/O 3등급 데이터 분류 + AI 연동 제한
```

### 1.1.1 CSAP 13개 도메인 전체 맵

```mermaid
mindmap
  root((CSAP 79항목\n중등급 기준))
    관리적 보안
      D-01 정보보호정책\n수립·이행
      D-02 조직/인원\n보안 역할 지정
      D-03 위험관리\n위협 분석·처리
      D-04 공급망 보안\nSBOM·의존성 관리
    기술적 보안
      D-05 서버/네트워크\n망분리·방화벽
      D-06 침해사고관리\n감사 로그 1년 보존
      D-07 취약점 관리\nCVE 패치 주기
      D-08 접근통제\nRBAC·세션 관리
      D-09 암호화\nAES-256·TLS 1.3
      D-10 로그관리\n중앙 수집·분석
    개발 보안
      D-11 개발환경 보안\n컨테이너 서명·정책
      D-12 시스템개발보안\n입력 검증·SQL 주입 방지
      D-13 변경관리\nPR·Q-Gate 승인
```

**개발자 직접 관련 도메인 우선순위**:

| 우선순위 | 도메인 | 개발자 책임 범위 | 위반 시 결과 |
|---------|--------|--------------|------------|
| 1위 | D-12 시스템 개발 보안 | Zod 입력 검증·파라미터화 쿼리·취약점 스캔 | Semgrep SAST 차단·Q-Gate G5 실패 |
| 2위 | D-08 접근 통제 | RBAC 검사·JWT 세션 관리·토큰 블랙리스트 | Reviewer HIGH 플래그·PR 머지 차단 |
| 3위 | D-09 암호화 | AES-256 저장 암호화·bcrypt 비밀번호 해시 | Secret Scan 자동 탐지·즉시 차단 |
| 4위 | D-06 침해사고 관리 | 감사 로그 전수 기록·1년 보존 | Q-Gate G7 실패·PR 머지 차단 |
| 5위 | D-04/D-11 공급망·가상화 | SBOM·이미지 서명·Kyverno 정책 | 이미지 서명 없으면 배포 차단 |

### 1.2 CSAP 79개 통제항목 영역별 구성

개발자가 일상 업무에서 직접 관련되는 핵심 영역은 다음과 같습니다.

| 영역 | 코드 | 항목 수 | 개발자 관련도 | 핵심 요건 |
|------|------|---------|------------|----------|
| 시스템 개발 보안 | D-12 | 10 | 매우 높음 | 입력 검증, SQL 주입 방지, 취약점 스캔 |
| 접근 통제 | D-08 | 12 | 높음 | RBAC, 세션 관리, API 인증 |
| 암호화 | D-09 | 4 | 높음 | AES-256, TLS 1.3+, 해시 |
| 침해사고 관리 | D-06 | 5 | 중간 | 감사 로그 필수, 1년 보존 |
| 공급망 보안 | D-05 | 3 | 중간 | SBOM, 의존성 취약점 |
| 가상화 보안 | D-11 | 4 | 중간 | 컨테이너 이미지 서명, 정책 |
| 가용성 | D-10 | 5 | 낮음 | 이중화, 백업 |

**D-12 시스템 개발 보안**은 가장 직접적으로 관련됩니다. 이 장에서 다루는 대부분의 내용이 D-12에 해당합니다.

### 1.3 컴플라이언스 위반 시 결과

| 위반 유형 | 발견 시점 | 결과 |
|---------|---------|------|
| 하드코딩 시크릿 | CI/CD Secret Scan | 파이프라인 즉시 차단 |
| SQL 직접 결합 | Semgrep SAST | Q-Gate G5 실패 |
| RBAC 없는 API | 코드 리뷰 | Reviewer 에이전트 HIGH 플래그 |
| audit.jsonl 누락 | Q-Gate G7 | PR 머지 차단 |
| N2SF C/S 등급 AI 전송 | 런타임 | 에러 반환 (BLOCKED) |
| 감리 시 미준수 발견 | 외부 감리 | 감리 결함 등록, 개선 이행 요구 |

---

## 2. 코드 레벨 보안 규칙

이 절은 `.claude/rules/csap-compliance.md`의 내용을 실무 예제 중심으로 설명합니다.

### 2.0 API 요청 보안 처리 플로우

모든 API 엔드포인트는 다음 순서로 보안 레이어를 통과해야 합니다.

```mermaid
sequenceDiagram
  participant CLIENT as 클라이언트
  participant GW as API Gateway
  participant AUTH_MW as JWT 검증\n(verifyToken)
  participant RBAC_MW as RBAC 검사\n(hasPermission)
  participant ZOD as Zod 입력 검증
  participant BIZ as 비즈니스 로직\n(파라미터화 쿼리)
  participant AUDIT as 감사 로그\n(auditLog)

  CLIENT->>GW: HTTP 요청 + Authorization 헤더
  GW->>AUTH_MW: JWT 토큰 전달
  AUTH_MW-->>GW: 토큰 없음·만료·서명 오류 → 401 Unauthorized
  AUTH_MW->>RBAC_MW: 인증된 사용자 + 요청 리소스
  RBAC_MW-->>GW: 권한 없음 → 403 Forbidden
  RBAC_MW->>ZOD: 요청 body + URL 파라미터
  ZOD-->>GW: 스키마 불일치 → 400 Bad Request
  ZOD->>BIZ: 검증된 입력값 (타입 안전)
  BIZ->>AUDIT: 민감 작업 감사 로그 기록 (D-06)
  BIZ-->>CLIENT: 200 OK (민감 정보 제외한 응답)
```

**보안 레이어 누락 시 결과**:

| 누락 레이어 | 위반 기준 | 발견 시점 | 결과 |
|-----------|---------|---------|------|
| JWT 검증 없음 | CSAP D-08 | 코드 리뷰·Reviewer 에이전트 | HIGH 플래그·PR 머지 차단 |
| RBAC 검사 없음 | CSAP D-08 | 코드 리뷰·Reviewer 에이전트 | HIGH 플래그·PR 머지 차단 |
| Zod 검증 없음 | CSAP D-12 | Semgrep SAST | Q-Gate G5 실패 |
| 감사 로그 없음 | CSAP D-06 | Q-Gate G7 | PR 머지 차단 |
| 문자열 SQL 결합 | CSAP D-12 | Semgrep + G5 패턴 탐지 | 파이프라인 즉시 차단 |

### 2.1 RBAC: 모든 API에 권한 검사 (D-08)

**원칙**: 모든 API 엔드포인트는 인증과 권한 검사를 거쳐야 합니다. 예외는 없습니다.

**올바른 패턴**:
```typescript
// Design Ref: §D-08 — RBAC 접근 통제
import { verifyToken, hasPermission } from '@/lib/auth'

export async function GET(req: Request) {
  // 1단계: 토큰 검증 (인증)
  const user = await verifyToken(req.headers.get('authorization') ?? '')
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2단계: 권한 검사 (인가)
  if (!hasPermission(user, 'resource:read')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 비즈니스 로직
  const data = await getResource()
  return Response.json(data)
}
```

**절대 금지 패턴**:
```typescript
// 인증 없는 직접 접근 — CSAP D-08 위반
export async function GET(req: Request) {
  const data = await db.query('SELECT * FROM sensitive_data')  // 차단
  return Response.json(data)
}
```

**권한 체계** (RBAC 역할):

| 역할 | 권한 범위 |
|------|---------|
| `admin` | 모든 리소스 읽기/쓰기/삭제 |
| `operator` | 테넌트 내 리소스 관리 |
| `user` | 자신의 리소스만 읽기/쓰기 |
| `viewer` | 읽기 전용 |

**세션 관리 규칙** (CSAP D-08):
- JWT 접근 토큰: 만료 15분
- JWT 갱신 토큰: 만료 7일
- 로그아웃 시 토큰 블랙리스트 Redis 등록
- 동시 세션 최대 3개

### 2.2 암호화: 저장 시 AES-256, 전송 시 TLS 1.3 (D-09)

**저장 암호화**:
```typescript
// Design Ref: §D-09 — AES-256 암호화
import { encrypt, decrypt } from '@/lib/crypto'

// 민감 데이터 저장 시 (주민등록번호, 계좌번호 등)
async function savePersonalInfo(data: PersonalInfo): Promise<void> {
  const encryptedData = await encrypt(JSON.stringify(data), process.env.ENCRYPTION_KEY!)
  await db.execute(
    'INSERT INTO personal_info (user_id, encrypted_data) VALUES ($1, $2)',
    [userId, encryptedData]
  )
}

// 복호화
async function getPersonalInfo(userId: string): Promise<PersonalInfo> {
  const row = await db.execute('SELECT encrypted_data FROM personal_info WHERE user_id = $1', [userId])
  return JSON.parse(await decrypt(row.encrypted_data, process.env.ENCRYPTION_KEY!))
}
```

**비밀번호 해시** (bcrypt, cost factor 12):
```typescript
import bcrypt from 'bcrypt'

// 비밀번호 저장 시
const hashedPassword = await bcrypt.hash(plainPassword, 12)

// 비밀번호 검증 시
const isValid = await bcrypt.compare(inputPassword, hashedPassword)
```

**금지 패턴**:
```typescript
// 평문 저장 — D-09 위반
await db.create({ password: plainPassword })  // 즉시 차단

// 하드코딩 암호화 키 — D-09 위반
const encrypted = encrypt(data, 'hardcoded-key-12345')  // 즉시 차단

// MD5/SHA-1 사용 — 취약 알고리즘
const hash = md5(password)  // 취약 알고리즘, 금지
```

**전송 암호화**: 모든 서비스 간 통신은 TLS 1.3+ 필수. HTTP 평문 통신은 절대 금지입니다.

### 2.3 입력 검증: Zod 스키마 필수 (D-12)

**원칙**: 모든 API 입력은 Zod 스키마로 검증해야 합니다. 검증 없이 입력값을 그대로 사용하는 것은 CSAP D-12 위반입니다.

**올바른 패턴**:
```typescript
// Design Ref: §D-12 — 입력 검증 (Zod)
import { z } from 'zod'

const createUserSchema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
  name: z.string().min(1, '이름은 필수입니다').max(100, '이름은 100자 이하입니다'),
  role: z.enum(['admin', 'operator', 'user', 'viewer']),
  tenantId: z.string().uuid('유효한 테넌트 ID가 아닙니다'),
})

export async function POST(req: Request) {
  const user = await verifyToken(req.headers.get('authorization') ?? '')
  if (!hasPermission(user, 'user:create')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  // 검증 실패 시 자동으로 400 Bad Request 반환
  const validated = createUserSchema.parse(body)

  // 이후 validated 객체 사용 (타입 안전 + 검증 완료)
  const newUser = await createUser(validated)
  return Response.json(newUser, { status: 201 })
}
```

**Zod 스키마 자주 사용하는 패턴**:
```typescript
// 날짜 범위 검증
const dateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
}).refine(
  (data) => new Date(data.startDate) <= new Date(data.endDate),
  { message: '시작일이 종료일보다 늦을 수 없습니다' }
)

// 선택적 필드
const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
})

// 중첩 객체
const tenantConfigSchema = z.object({
  tenant: z.object({
    id: z.string().uuid(),
    settings: z.record(z.string(), z.unknown()),
  }),
})
```

### 2.4 SQL 주입 방지: 파라미터화 쿼리

**원칙**: SQL 쿼리는 반드시 파라미터화 쿼리를 사용합니다. 문자열 직접 결합은 절대 금지입니다.

**올바른 패턴**:
```typescript
// 파라미터화 쿼리 ($1, $2 자리표시자)
const user = await db.execute(
  'SELECT id, name, email FROM users WHERE email = $1 AND tenant_id = $2',
  [email, tenantId]  // 파라미터 배열 (SQL 주입 방지)
)

// ORM 사용 시 (TypeORM/Prisma)
const users = await userRepository.find({
  where: { email: In(emailList), tenantId }  // ORM이 자동으로 파라미터화
})
```

**절대 금지 패턴**:
```typescript
// 문자열 직접 결합 — SQL 주입 공격 가능
const query = `SELECT * FROM users WHERE email = '${email}'`  // 즉시 차단
const user = await db.execute(query)

// 템플릿 리터럴도 동일하게 금지
const data = await db.execute(`DELETE FROM logs WHERE id = ${id}`)  // 즉시 차단
```

**실제 SQL 주입 예시** (왜 위험한지 이해):
```
정상 입력:  email = "user@example.com"
쿼리 결과: SELECT * FROM users WHERE email = 'user@example.com'

악의적 입력: email = "' OR '1'='1"
쿼리 결과: SELECT * FROM users WHERE email = '' OR '1'='1'
결과: 모든 사용자 데이터 유출!
```

### 2.5 XSS 방지: DOMPurify 사용

HTML을 사용자에게 렌더링하는 경우 반드시 DOMPurify로 새니타이즈합니다.

```typescript
import DOMPurify from 'dompurify'

// 사용자 입력 HTML을 화면에 표시하는 경우
function renderUserContent(htmlContent: string): string {
  // XSS 공격 방지 (스크립트 태그, 이벤트 핸들러 제거)
  const sanitized = DOMPurify.sanitize(htmlContent, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [],
  })
  return sanitized
}
```

**React 환경에서 dangerouslySetInnerHTML 사용 금지**:
```tsx
// 금지: XSS 취약점
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// 허용: DOMPurify 새니타이즈 후 사용
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />
```

### 2.6 하드코딩 시크릿 절대 금지

**원칙**: API 키, 비밀번호, 토큰 등 모든 시크릿은 환경 변수로 관리합니다.

**올바른 패턴**:
```typescript
// 환경 변수에서 시크릿 로드
const apiKey = process.env.EXTERNAL_API_KEY
const jwtSecret = process.env.JWT_SECRET
const dbPassword = process.env.DB_PASSWORD

// 환경 변수 누락 시 명시적 에러
if (!apiKey) {
  throw new Error('EXTERNAL_API_KEY 환경 변수가 설정되지 않았습니다')
}
```

**절대 금지 패턴**:
```typescript
// 하드코딩 시크릿 — D-09 위반, CI에서 자동 탐지
const apiKey = 'sk-1234567890abcdefghijklmnop'  // 즉시 차단
const jwtSecret = 'my-super-secret-key'          // 즉시 차단
const password = 'admin123'                       // 즉시 차단
```

**환경 변수 목록** (`.env.example` 참조):
```bash
# 데이터베이스
DATABASE_URL=postgresql://user:password@host:5432/db

# 인증
JWT_SECRET=<Vault에서 자동 주입>
JWT_REFRESH_SECRET=<Vault에서 자동 주입>

# 암호화
ENCRYPTION_KEY=<Vault에서 자동 주입>

# 외부 서비스 (O등급 데이터만)
AI_GATEWAY_URL=http://ai-gateway.saas.local
AI_GATEWAY_TOKEN=<Vault에서 자동 주입>
```

### 2.7 에러 처리: 민감 정보 노출 금지

**원칙**: 에러 응답에 스택 트레이스, DB 연결 정보, 내부 구현 세부사항을 포함하면 안 됩니다.

**올바른 패턴**:
```typescript
import { randomUUID } from 'crypto'
import { logger } from '@/lib/logger'

export async function GET(req: Request) {
  try {
    // 비즈니스 로직
    return Response.json(data)
  } catch (error) {
    // 에러 ID 생성 (추적용)
    const errorId = randomUUID()

    // 내부 로그에는 상세 정보 기록
    logger.error('Internal error', {
      errorId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    // 외부 응답에는 최소 정보만
    return Response.json(
      { error: 'Internal server error', errorId },
      { status: 500 }
    )
  }
}
```

**절대 금지 패턴**:
```typescript
catch (error) {
  // 스택 트레이스, DB 정보 노출 — 즉시 차단
  return Response.json({
    error: error.message,
    stack: error.stack,
    dbUrl: process.env.DATABASE_URL,  // 절대 금지
  })
}
```

---

## 3. N2SF 데이터 등급 분류

### 3.1 N2SF 데이터 등급 체계

국가 클라우드 보안프레임워크(N2SF)는 공공 데이터를 보안 등급에 따라 세 가지로 분류합니다. 이 분류는 특히 **AI API 연동 시 반드시 확인**해야 합니다.

| 등급 | 명칭 | 설명 | AI 전송 |
|------|------|------|--------|
| C | 기밀 (Confidential) | 국가 기밀, 개인정보, 보안 관련 정보 | 절대 금지 |
| S | 민감 (Sensitive) | 업무상 민감한 정보, 일부 개인정보 | 절대 금지 |
| O | 공개 (Open) | 공개 가능한 정보, 비식별 통계 | PII 마스킹 후 가능 |

### 3.2 등급별 데이터 예시

**C등급 (기밀) — AI 전송 절대 금지**:
```
개인 식별 정보:
  - 주민등록번호
  - 여권번호, 운전면허번호
  - 의료 기록, 진단 정보
  - 금융 계좌번호, 카드번호

기관 기밀:
  - 보안 시스템 구성 정보
  - 암호화 키, 인증서
  - 내부 인프라 IP/포트 정보
  - 미공개 정책/규정 초안
```

**S등급 (민감) — AI 전송 절대 금지**:
```
업무 민감 정보:
  - 직원 인사 정보 (이름, 직급, 연봉)
  - 계약 협상 내용
  - 내부 감사 결과
  - 취약점 분석 보고서

일부 개인정보:
  - 이메일 주소 + 이름 조합
  - 전화번호
  - 생년월일
  - 거주 주소
```

**O등급 (공개) — PII 마스킹 후 AI 전송 가능**:
```
공개 가능 정보:
  - 익명화된 사용 통계
  - 공개된 정책 문서
  - 비식별 처리된 데이터
  - 공개 API 응답 데이터
  - 일반 코드/로그 (개인정보 미포함)
```

### 3.3 AI API 연동 보안 규칙

N2SF 규칙에 따라 AI API를 호출하는 코드는 반드시 다음 패턴을 따라야 합니다.

**표준 구현 패턴** (`.claude/rules/csap-compliance.md` 기준):
```typescript
// Design Ref: §N2SF N-05 — AI API 데이터 등급 검사
// Plan SC: AI-REQ-1

enum DataGrade { C = 'C', S = 'S', O = 'O' }

async function sendToAI(data: unknown, grade: DataGrade): Promise<AIResponse> {
  // C, S 등급: AI API 전송 절대 금지
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(
      `BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05). ` +
      `데이터를 비식별화하거나 O등급으로 변환한 후 재시도하십시오.`
    )
  }

  // O 등급: PII 마스킹 후 전송
  const masked = await maskPII(data)

  // AI Gateway 경유 (직접 외부 API 호출 절대 금지)
  return aiGateway.send(masked)
}

// PII 마스킹 함수
async function maskPII(data: unknown): Promise<unknown> {
  const str = JSON.stringify(data)
  return JSON.parse(
    str
      .replace(/\d{6}-\d{7}/g, '[주민번호 마스킹]')     // 주민등록번호
      .replace(/\d{3}-\d{4}-\d{4}/g, '[전화 마스킹]')   // 전화번호
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[이메일 마스킹]')
  )
}
```

**AI Gateway 경유 필수**: 외부 AI API(OpenAI, Claude 등)를 직접 호출하는 것은 절대 금지입니다. 반드시 내부 AI Gateway를 경유해야 합니다. 이는 `CLAUDE.md §외부 클라우드 서비스 사용 금지` 원칙에 해당합니다.

```typescript
// 금지: 외부 AI API 직접 호출
import OpenAI from 'openai'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const response = await openai.chat.completions.create(...)  // 즉시 차단

// 허용: AI Gateway 경유
import { aiGateway } from '@/lib/ai-gateway'
const response = await aiGateway.send({ prompt, context })  // AI Gateway 경유
```

### 3.4 실무 적용 흐름

```
데이터 처리 요청
    │
    ▼
[데이터 등급 확인]
    ├── C 또는 S 등급? → AI 전송 불가 에러 반환
    │                    로컬 처리 또는 비식별화 요청
    │
    └── O 등급?
            │
            ▼
        [PII 마스킹]
            │
            ▼
        [AI Gateway 전송]
            │
            ▼
        [응답 처리]
```

### 3.5 N2SF 데이터 흐름 보안 다이어그램

각 등급의 데이터가 시스템 내에서 어떻게 처리되는지 전체 흐름을 보여줍니다.

```mermaid
flowchart TD
  INPUT[데이터 수신] --> CLASSIFY{N2SF 등급 분류}

  CLASSIFY -->|C등급\n주민번호·의료기록·암호화키| C_PATH[로컬 처리 전용]
  CLASSIFY -->|S등급\n인사정보·계약내용·취약점보고서| S_PATH[로컬 처리 전용]
  CLASSIFY -->|O등급\n공개통계·비식별데이터| O_PATH[AI 연동 가능 경로]

  C_PATH --> C_STORE[AES-256 암호화 저장\nD-09 준수]
  C_PATH --> C_BLOCK[AI Gateway 전송 차단\nBLOCKED 에러 반환]
  S_PATH --> S_STORE[AES-256 암호화 저장\nD-09 준수]
  S_PATH --> S_BLOCK[AI Gateway 전송 차단\nBLOCKED 에러 반환]

  O_PATH --> PII_MASK[PII 마스킹\n주민번호·전화·이메일 치환]
  PII_MASK --> GW[AI Gateway 경유\nai-gateway.saas.local]
  GW --> EXT_AI[외부 AI API\nClaude·GPT 등]
  EXT_AI --> RESPONSE[응답 처리\nN2SF O등급 출력만 허용]

  C_STORE --> AUDIT_C[감사 로그 기록\nDATA_ACCESS C등급]
  S_STORE --> AUDIT_S[감사 로그 기록\nDATA_ACCESS S등급]
  RESPONSE --> AUDIT_O[감사 로그 기록\nAI_QUERY O등급]
```

**N2SF 등급별 처리 규칙 요약**:

| 등급 | 저장 방식 | AI 전송 | 접근 제어 | 감사 로그 |
|------|---------|--------|---------|---------|
| C (기밀) | AES-256 암호화 필수 | 절대 금지 | admin 이상 | 전수 기록 |
| S (민감) | AES-256 암호화 필수 | 절대 금지 | operator 이상 | 전수 기록 |
| O (공개) | 일반 저장 가능 | PII 마스킹 후 AI Gateway 경유 | user 이상 | 선택적 기록 |

**보안 위반 사례 vs 올바른 패턴**:

| 위반 유형 | 잘못된 패턴 | 올바른 패턴 | N2SF 조항 |
|---------|-----------|-----------|---------|
| C등급 AI 전송 | 주민번호를 AI 프롬프트에 직접 포함 | C등급 탐지 후 `BLOCKED` 에러 반환 | N-05 |
| PII 미마스킹 | 이메일 주소 포함된 로그를 AI에 전송 | 이메일 패턴 치환 후 전송 | N-05 |
| 직접 AI 호출 | `openai.chat.completions.create()` 직접 사용 | `aiGateway.send()` 경유 필수 | N-03 |
| 암호화 누락 | 주민번호를 평문으로 DB 저장 | `encrypt()` 함수로 AES-256 암호화 후 저장 | N-02 |

---

## 4. 감사 로그 작성법

### 4.1 감사 로그의 중요성

CSAP D-06 (침해사고 관리)에 따라 모든 민감 작업은 감사 로그에 기록해야 합니다. 이는 법적 요건이며, Q-Gate G7에서 자동으로 확인됩니다.

**감사 로그 파일**: `.claude/audit.jsonl` (JSONL 형식, append-only)

**보존 기간**: 최소 1년 (CSAP D-06)

**무결성**: 수정/삭제 불가 구조 (append-only JSONL)

### 4.2 감사 로그가 필요한 작업 목록

다음 작업은 반드시 감사 로그를 기록해야 합니다.

| 작업 유형 | 예시 | 심각도 |
|---------|------|--------|
| 사용자 관리 | 생성, 수정, 삭제, 역할 변경 | HIGH |
| 접근 제어 | 권한 부여, 취소 | HIGH |
| 데이터 조작 | 개인정보 조회, 삭제, 수출 | HIGH |
| 인증 이벤트 | 로그인 실패, 토큰 갱신 | MEDIUM |
| 설정 변경 | 시스템 설정, 정책 변경 | HIGH |
| 배포 이벤트 | 서비스 배포, 롤백 | HIGH |
| 보안 이벤트 | 침해 시도, 차단 | CRITICAL |

### 4.3 auditLog() 함수 사용법

```typescript
// Design Ref: §D-06 — 감사 로깅
// Plan SC: FR-AUDIT-1
import { auditLog } from '@/lib/audit'

// 기본 사용법
await auditLog({
  actor: user.id,           // 작업 수행자 ID
  action: 'USER_DELETE',    // 작업 유형 (대문자 스네이크 케이스)
  target: targetUserId,     // 대상 리소스 ID
  timestamp: new Date().toISOString(),
  ip: getClientIP(req),     // 요청자 IP
})

// 추가 컨텍스트 포함
await auditLog({
  actor: adminUser.id,
  action: 'PERMISSION_GRANT',
  target: targetUserId,
  timestamp: new Date().toISOString(),
  ip: getClientIP(req),
  detail: {
    previousRole: 'user',
    newRole: 'admin',
    reason: '팀장 요청',
  },
  csapRef: 'D-08',          // 관련 CSAP 통제항목
})
```

**실제 구현 예시 (삭제 API)**:
```typescript
async function deleteUser(
  adminUser: AuthenticatedUser,
  targetUserId: string,
  req: Request
): Promise<void> {
  // 1. 감사 로그 먼저 기록 (작업 전)
  await auditLog({
    actor: adminUser.id,
    action: 'USER_DELETE',
    target: targetUserId,
    timestamp: new Date().toISOString(),
    ip: getClientIP(req),
    detail: { reason: '계정 비활성화 요청' },
    csapRef: 'D-06',
  })

  // 2. 실제 작업 수행
  await db.execute('UPDATE users SET deleted_at = NOW() WHERE id = $1', [targetUserId])

  // 3. 후속 감사 (성공 확인)
  await auditLog({
    actor: adminUser.id,
    action: 'USER_DELETE_COMPLETE',
    target: targetUserId,
    timestamp: new Date().toISOString(),
    ip: getClientIP(req),
  })
}
```

### 4.4 .claude/audit.jsonl 구조

각 줄은 독립적인 JSON 객체입니다.

```json
{"timestamp":"2026-04-11T09:15:00Z","actor":"admin-user-uuid","action":"USER_DELETE","target":"target-user-uuid","ip":"10.0.1.55","detail":{"reason":"퇴사 처리"},"csap_ref":"D-06"}
{"timestamp":"2026-04-11T09:20:00Z","actor":"ci-pipeline","action":"DEVSECOPS_SCAN","ref":"refs/heads/main","sha":"abc1234","trivy":"success","semgrep":"success","csap_ref":"D-05,D-08,D-12"}
{"timestamp":"2026-04-11T09:30:00Z","actor":"dora-gate","action":"DEPLOY_BLOCKED","detail":"CFR=32%,namespace=production,team=platform","csap_ref":"D-12"}
```

**주의사항**: `.claude/audit.jsonl`은 절대 삭제하거나 기존 라인을 수정하면 안 됩니다. 새 항목은 반드시 파일 끝에 추가(append)해야 합니다.

### 4.5 감사 로그 체인 무결성 다이어그램

append-only JSONL 구조가 무결성을 어떻게 보장하는지 보여줍니다.

```mermaid
flowchart LR
  subgraph CHAIN [audit.jsonl — append-only 체인]
    direction TB
    E1["{ timestamp: T1\n  action: USER_CREATE\n  sha256: h1 }"]
    E2["{ timestamp: T2\n  action: PERMISSION_GRANT\n  sha256: h2\n  prev_hash: h1 }"]
    E3["{ timestamp: T3\n  action: DEPLOY_BLOCKED\n  sha256: h3\n  prev_hash: h2 }"]
    E1 --> E2 --> E3
  end

  NEW[새 이벤트 발생] -->|append 전용| E3
  VERIFY[무결성 검증\nsha256sum -c] --> CHAIN
  TAMPER[기존 항목 수정 시도] -->|감사 시스템 탐지\n체크섬 불일치| ALERT[보안 알림\nCSAP D-06 위반]
```

**audit.jsonl 필드 설명**:

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `timestamp` | ISO 8601 문자열 | 필수 | UTC 기준 이벤트 발생 시각 |
| `actor` | UUID 문자열 | 필수 | 작업 수행자 ID (사용자 UUID 또는 시스템 ID) |
| `action` | 대문자 스네이크 | 필수 | 작업 유형 (예: `USER_DELETE`, `DEPLOY_BLOCKED`) |
| `target` | 문자열 | 조건부 | 대상 리소스 ID (사용자·파일·배포 등) |
| `ip` | IP 주소 문자열 | 권고 | 요청자 IP (보안 사고 추적용) |
| `detail` | JSON 객체 | 선택 | 추가 컨텍스트 (역할 변경 전후값 등) |
| `csap_ref` | 문자열 | 권고 | 관련 CSAP 통제항목 (예: `D-06`, `D-08`) |

**보안 위반 사례 vs 올바른 패턴**:

| 상황 | 잘못된 패턴 | 올바른 패턴 |
|------|-----------|-----------|
| 기존 항목 수정 | 오류 수정 목적으로 기존 줄 편집 | 수정 불가. 정정 이유를 새 항목으로 append |
| 파일 삭제 | 용량 절감을 위해 오래된 로그 삭제 | 최소 1년 보존 필수 (CSAP D-06). 별도 아카이브 |
| 민감 정보 포함 | `detail`에 비밀번호·주민번호 기록 | `detail`에 식별자(UUID)만 기록. 원본은 암호화 저장 |
| 감사 로그 미기록 | 사용자 삭제 후 로그 없음 | 삭제 전 `auditLog()` 호출 필수 (Q-Gate G7 자동 확인) |

### 4.5 감사 로그 조회 방법

```bash
# 오늘 모든 감사 로그 조회
grep "2026-04-11" .claude/audit.jsonl | jq .

# 특정 사용자의 작업 조회
grep '"actor":"user-uuid-here"' .claude/audit.jsonl | jq .

# 특정 액션 유형 조회
grep '"action":"USER_DELETE"' .claude/audit.jsonl | jq .

# 오류/차단 이벤트 조회
grep -E '"action":"(DEPLOY_BLOCKED|BLOCKED|CRITICAL)"' .claude/audit.jsonl | jq .

# 날짜 범위 조회 (2026-04-10 ~ 2026-04-11)
awk '/2026-04-10/,/2026-04-12/' .claude/audit.jsonl | jq .

# 최근 20개 이벤트
tail -20 .claude/audit.jsonl | jq .
```

---

## 5. 환경 변수 및 시크릿 관리

### 5.1 HashiCorp Vault 사용법

프로젝트의 모든 시크릿은 HashiCorp Vault에서 중앙 관리됩니다. 개발자가 직접 시크릿을 생성하거나 로컬 파일에 보관하는 것은 금지됩니다.

**Vault 접근 방법**:
```bash
# Vault CLI를 통한 접근 (로컬 개발 환경)
export VAULT_ADDR='https://vault.saas.local'
export VAULT_TOKEN=$(cat ~/.vault-token)

# 시크릿 조회
vault kv get secret/saas-platform/development

# 특정 키 조회
vault kv get -field=JWT_SECRET secret/saas-platform/development
```

**경로 구조**:
```
secret/saas-platform/
  ├── development/    ← 개발 환경
  ├── staging/        ← 스테이징 환경
  └── production/     ← 프로덕션 환경 (접근 제한)
```

**접근 권한**: 개발자는 `development/` 경로만 접근 가능합니다. `production/` 경로는 운영팀과 자동화 파이프라인만 접근 가능합니다.

### 5.2 External Secrets Operator (ESO)

k8s 파드는 External Secrets Operator를 통해 Vault에서 시크릿을 자동으로 주입받습니다.

```yaml
# 예시: ExternalSecret 리소스
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: auth-service-secrets
  namespace: saas-platform
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: ClusterSecretStore
  target:
    name: auth-service-secrets
    creationPolicy: Owner
  data:
    - secretKey: JWT_SECRET
      remoteRef:
        key: secret/saas-platform/production
        property: JWT_SECRET
    - secretKey: ENCRYPTION_KEY
      remoteRef:
        key: secret/saas-platform/production
        property: ENCRYPTION_KEY
```

**파드 환경에서의 사용**: ESO가 생성한 k8s Secret이 파드에 환경 변수로 자동 마운트됩니다.

### 5.3 로컬 개발 환경 시크릿 관리

로컬 개발 환경에서는 `.env.local` 파일을 사용하되, 절대 저장소에 커밋하면 안 됩니다.

```bash
# .env.local 파일 생성 (저장소에 커밋 금지)
cp docs/env.example .env.local

# .env.local 편집 (Vault에서 개발 환경 값 복사)
vault kv get -format=json secret/saas-platform/development | \
  jq -r '.data.data | to_entries | map(.key + "=" + .value) | .[]' \
  >> .env.local
```

**.gitignore 확인**: `.env*` 파일은 이미 `.gitignore`에 포함되어 있습니다. 실수로 커밋되지 않도록 항상 `git status`로 확인하십시오.

### 5.4 .env 파일 커밋이 금지된 이유

`CLAUDE.md §1 절대 제약`에 명시된 이유:

1. **보안 침해**: `.env` 파일이 저장소에 노출되면 모든 시크릿이 공개됩니다.
2. **감사 추적 파괴**: 시크릿 변경 이력이 git 히스토리에 영구 기록됩니다.
3. **CSAP D-09 위반**: 암호화 키의 불안전한 저장으로 직접 위반이 발생합니다.
4. **복구 불가**: git 히스토리에서 시크릿을 완전히 제거하는 것은 매우 어렵습니다.

**실수로 커밋한 경우 즉시 처리**:
1. 해당 시크릿 즉시 폐기 및 재발급
2. 보안팀 즉시 보고
3. `.claude/audit.jsonl`에 사고 기록
4. git 히스토리 정리 (보안팀 승인 필요)

---

## 6. CSAP 증거 수집 자동화

### 6.1 csap-evidence.yml 파이프라인

**실행 주기**: 매주 월요일 09:00 KST 자동 실행 + 수동 트리거 지원

**목적**: CSAP 감리·인증 시 제출할 증거 자료를 자동으로 수집하여 `evidence/` 디렉토리에 보관합니다.

**수동 실행 방법**:
```bash
# Gitea Actions에서 workflow_dispatch 트리거
# 또는 CLI
gh workflow run csap-evidence.yml \
  --field date="2026-04-11" \
  --field controls="D-06,D-08,D-12"
```

### 6.2 수집되는 증거 항목

| CSAP 영역 | 수집 증거 | 자동화 여부 |
|---------|---------|------------|
| D-06 침해사고 | audit.jsonl 현황, 이상 이벤트 통계 | 자동 |
| D-08 접근 통제 | RBAC 설정 현황, 계정 목록 | 자동 |
| D-09 암호화 | 암호화 정책 적용 현황 | 부분 자동 |
| D-12 개발 보안 | Semgrep 리포트, Trivy 스캔 결과 | 자동 |
| D-05 공급망 | SBOM 파일, 의존성 감사 결과 | 자동 |
| D-11 가상화 | Kyverno 정책 준수 현황 | 자동 |

**증거 파일 위치**: `evidence/YYYY-MM-DD/` (날짜별 디렉토리)

**무결성 검증**: `manifest.sha256` 파일로 모든 증거 파일의 SHA256 체크섬을 기록합니다.

### 6.3 증거 수집 스크립트 직접 실행

```bash
# 전체 증거 수집 (오늘 날짜)
./scripts/csap-evidence-collect-v2.sh

# 특정 날짜
./scripts/csap-evidence-collect-v2.sh --date 2026-04-01

# 특정 통제항목만
./scripts/csap-evidence-collect-v2.sh --controls D-06,D-08

# 무결성 검증
cd evidence/2026-04-11
sha256sum -c manifest.sha256
```

### 6.4 감리 대비 준비

외부 감리는 통상 분기별로 실시됩니다. 감리 준비 시 다음을 확인하십시오.

```bash
# 감리 대비 보고서 생성
./scripts/audit-readiness-report.sh

# Q-Gate 전수 검증
./scripts/qgate-verify.sh

# CSAP 커버리지 확인
./scripts/csap-coverage-check.sh
```

**`audit-gate.yaml`** 워크플로우는 매일 06:00 KST에 자동으로 감리 준비 상태를 점검합니다.

---

## 7. 보안 검사 도구

### 7.1 Semgrep: 정적 코드 분석

**목적**: 소스 코드에서 보안 취약점 패턴을 정적으로 탐지

**로컬 설치 및 실행**:
```bash
# 설치
pip install semgrep

# 전체 스캔 (OWASP Top 10 포함)
semgrep scan \
  --config auto \
  --config "p/owasp-top-ten" \
  --config "p/typescript" \
  platform/

# 특정 서비스만 스캔
semgrep scan --config auto platform/services/auth-service/

# SARIF 형식으로 리포트 저장
semgrep scan --config auto --sarif -o semgrep-report.sarif platform/
```

**주요 탐지 패턴**:
- `p/owasp-top-ten`: SQL 주입, XSS, 경로 조작, 민감 정보 노출
- `p/typescript`: TypeScript 전용 보안 패턴 (타입 단언 남용 등)
- `auto`: 사용 중인 프레임워크 자동 감지 후 규칙 적용

**결과 해석**:
```
ERROR: 즉시 수정 필요 (CI 파이프라인 차단)
WARNING: 검토 후 수정 (보고서에 기록)
INFO: 참고사항
```

### 7.2 Trivy: 컨테이너 취약성 스캔

**목적**: Docker 이미지, 파일시스템, IaC 설정의 취약점 탐지

**기본 사용법**:
```bash
# 이미지 스캔 (HIGH, CRITICAL만)
trivy image --severity HIGH,CRITICAL \
  harbor.saas.local/public-saas/auth-service:latest

# 파일시스템 스캔 (소스 코드 의존성)
trivy fs --severity HIGH,CRITICAL .

# IaC 설정 스캔 (Helm, k8s YAML)
trivy config --severity HIGH,CRITICAL helm/saas-platform/

# 수정된 취약점만 표시 (ignore-unfixed)
trivy image --ignore-unfixed --severity HIGH,CRITICAL \
  harbor.saas.local/public-saas/auth-service:latest
```

**취약점 심각도 기준**:
| 등급 | 기준 | 파이프라인 영향 |
|------|------|--------------|
| CRITICAL | CVSS 9.0+ | 즉시 배포 차단 |
| HIGH | CVSS 7.0-8.9 | 배포 전 수정 권고 |
| MEDIUM | CVSS 4.0-6.9 | 다음 배포 전 수정 |
| LOW | CVSS 0.1-3.9 | 백로그 등록 |

**취약점 대응 방법**:
```bash
# 1. 취약한 패키지 확인
trivy fs --severity HIGH,CRITICAL --format json . | jq '.Results[].Vulnerabilities'

# 2. 패키지 업데이트
pnpm update {패키지명}@latest

# 3. 업데이트 후 재스캔
trivy fs --severity HIGH,CRITICAL .

# 4. 허용 취약점 등록 (충분한 근거 있는 경우만)
# .trivyignore 파일에 CVE 번호 추가
echo "CVE-2026-XXXXX" >> .trivyignore
```

### 7.3 Falco: 런타임 이상 탐지

**목적**: 실행 중인 컨테이너에서 비정상 행동을 실시간으로 탐지

Falco는 k3s 클러스터에 DaemonSet으로 배포되어 실행 중입니다. 개발자가 직접 설정을 변경하지 않습니다.

**탐지 규칙 예시**:
- 컨테이너 내 셸 실행 (`/bin/sh`, `/bin/bash`)
- 민감 파일 접근 (`/etc/passwd`, `/proc/*/mem`)
- 네트워크 포트 비정상 바인딩
- 과도한 CPU/메모리 사용 (cryptomining 징후)

**Falco 알림 수신**: 보안팀 슬랙 채널로 즉시 알림이 발송됩니다.

**개발자 조치**: Falco 알림을 받은 경우 즉시 보안팀에 보고하십시오.

### 7.4 Kyverno: 정책 위반 차단

**목적**: k8s 리소스 배포 전 정책 준수 여부를 자동으로 검사하고 위반 시 배포 차단

**주요 정책 목록**:
```
verify-image-signature   : 서명되지 않은 이미지 배포 차단
require-resource-limits  : CPU/메모리 제한 미설정 파드 차단
disallow-privileged      : Privileged 컨테이너 차단
require-non-root         : root 사용자 실행 차단
require-labels           : 필수 레이블(app, version, team) 미설정 차단
```

**정책 위반 시 로컬 확인**:
```bash
# Kyverno CLI 설치
curl -sSfL https://github.com/kyverno/kyverno/releases/latest/download/kyverno-cli_linux_amd64.tar.gz | \
  tar xz -C /usr/local/bin kyverno

# 정책 사전 검증
kyverno apply infra/kyverno/ --resource deploy/base/deployment.yaml
```

### 7.5 OpenSSF Scorecard (scorecard.yaml)

**목적**: 저장소의 오픈소스 보안 점수를 자동으로 측정

**측정 항목**:
- Code Review (코드 리뷰 정책)
- Branch Protection (브랜치 보호 설정)
- Token Permissions (최소 권한 워크플로우)
- Vulnerabilities (취약점 현황)
- SAST (정적 분석 적용 여부)

---

## 8. 보안 사고 대응

### 8.0 보안 사고 대응 플로우차트

```mermaid
flowchart TD
  INCIDENT[보안 사고 감지] --> TYPE{사고 유형 분류}

  TYPE -->|하드코딩 시크릿 커밋| SECRET_PROC[시크릿 즉시 폐기·재발급\n5분 이내]
  TYPE -->|Trivy·Semgrep 취약점 발견| VULN_PROC[CVE 등급 평가\nCRITICAL: 24h 패치]
  TYPE -->|Falco 런타임 알림| FALCO_PROC[파드 즉시 격리\nkubectl cordon]
  TYPE -->|무단 데이터 접근| ACCESS_PROC[계정 즉시 비활성화\n접근 범위 파악]

  SECRET_PROC --> NOTIFY_SEC[보안팀 즉시 보고\nSlack #security-incident]
  VULN_PROC --> NOTIFY_SEC
  FALCO_PROC --> NOTIFY_SEC
  ACCESS_PROC --> NOTIFY_SEC

  NOTIFY_SEC --> AUDIT_ENTRY[감사 로그 기록\naudit.jsonl append]
  AUDIT_ENTRY --> REPORT[감사 보고서 작성\nPost-Mortem 문서]
  REPORT --> CSAP_EVIDENCE[CSAP 증거 수집\ncsap-evidence.yml 실행]
  CSAP_EVIDENCE --> PREVENT[재발 방지 조치\nGitHub Issue 등록]
```

**사고 유형별 대응 시간 기준**:

| 사고 유형 | 1차 대응 (즉시) | 2차 대응 (10분 내) | 3차 대응 (1일 내) |
|---------|--------------|-----------------|----------------|
| 하드코딩 시크릿 | 시크릿 폐기 | 보안팀 보고 + 감사 로그 | Post-Mortem 문서 |
| CRITICAL 취약점 | 파이프라인 자동 차단 | 패치 또는 임시 조치 | 재스캔 확인 + 이슈 등록 |
| Falco 알림 | 파드 격리 (`kubectl cordon`) | 포렌식 분석 요청 | 영향 범위 보고서 |
| 무단 접근 | 계정 비활성화 | 접근 데이터 범위 파악 | 개인정보보호팀 보고 (ISMS-P) |

### 8.1 보안 사고 유형별 대응 절차

**유형 1: 하드코딩 시크릿 발견**

```
1. [즉시] CI/CD 파이프라인이 자동 차단 (Secret Scan)
2. [5분 내] 해당 시크릿 즉시 폐기 및 재발급
   - API 키: 발급 서비스에서 즉시 비활성화
   - DB 비밀번호: 즉시 변경 + 연결 재설정
   - JWT 시크릿: Vault에서 즉시 교체 + 활성 세션 무효화
3. [10분 내] 보안팀 보고 (Slack #security-incident)
4. [30분 내] 감사 로그 기록
   echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","actor":"'$USER'","action":"SECRET_INCIDENT","detail":"하드코딩 시크릿 발견 및 폐기","csap_ref":"D-09"}' >> .claude/audit.jsonl
5. [1일 내] 사후 분석 문서 작성 (재발 방지 조치 포함)
```

**유형 2: 취약점 발견 (Trivy/Semgrep)**

```
CRITICAL 취약점:
  1. 파이프라인 즉시 차단 (자동)
  2. 보안팀 즉시 보고
  3. 24시간 내 패치 또는 임시 조치
  4. 패치 후 재스캔 확인

HIGH 취약점:
  1. 다음 배포 전까지 패치 권고
  2. 스프린트 백로그에 등록
  3. 패치 완료 후 재스캔

MEDIUM/LOW 취약점:
  1. 백로그 이슈 등록
  2. 분기별 정기 점검 시 처리
```

**유형 3: 런타임 이상 탐지 (Falco)**

```
1. Falco 알림 수신 (보안팀 슬랙)
2. 해당 파드 즉시 격리
   kubectl cordon {노드명}
   kubectl delete pod {파드명} -n saas-platform
3. 컨테이너 로그 및 이미지 무결성 확인
4. 포렌식 분석 수행 (보안팀)
5. 영향 범위 파악 및 보고
6. 감사 로그에 사고 기록
```

**유형 4: 무단 데이터 접근**

```
1. 감사 로그에서 접근 이력 추적
   grep '"action":".*READ"' .claude/audit.jsonl | grep '"actor":"의심 사용자 ID"'
2. 해당 계정 즉시 비활성화
3. 접근된 데이터 범위 파악
4. 개인정보 관련 시 개인정보보호팀 즉시 보고 (ISMS-P 요건)
5. 필요 시 관계 기관 보고 (개인정보보호위원회)
```

### 8.2 보안 취약점 신고 절차

팀 내부에서 보안 취약점을 발견한 경우:

1. 공개 이슈 트래커에 올리지 마십시오
2. 보안팀 이메일(`security@saas.local`)로 직접 보고
3. 재현 방법과 영향 범위를 함께 제출
4. 보안팀의 승인 후 일반 이슈로 전환 (공개 여부 결정)

---

## 9. 체크리스트: PR 제출 전 보안 점검

PR을 제출하기 전에 아래 체크리스트를 확인하십시오. 모든 항목에 체크해야 PR을 올릴 수 있습니다.

### 9.0 PR 보안 체크리스트 플로우차트

개발자가 PR 제출 전 순서대로 점검해야 할 흐름을 시각화합니다.

```mermaid
flowchart TD
  START[PR 제출 준비] --> RBAC_CHECK{모든 API에\nverifyToken + hasPermission\n있는가?}
  RBAC_CHECK -->|없음| FIX_RBAC[RBAC 추가\nCSAP D-08 요건]
  RBAC_CHECK -->|있음| INPUT_CHECK{모든 API 입력에\nZod 스키마 검증\n있는가?}

  FIX_RBAC --> INPUT_CHECK
  INPUT_CHECK -->|없음| FIX_ZOD[Zod 스키마 추가\nCSAP D-12 요건]
  INPUT_CHECK -->|있음| SQL_CHECK{SQL 문자열\n직접 결합이\n없는가?}

  FIX_ZOD --> SQL_CHECK
  SQL_CHECK -->|있음| FIX_SQL[파라미터화 쿼리로 교체\n$1 $2 자리표시자]
  SQL_CHECK -->|없음| SECRET_CHECK{하드코딩된\n시크릿이\n없는가?}

  FIX_SQL --> SECRET_CHECK
  SECRET_CHECK -->|있음| FIX_SECRET[환경 변수로 교체\nprocess.env.XXX]
  SECRET_CHECK -->|없음| AUDIT_CHECK{감사 로그\n대상 작업에\nauditLog 있는가?}

  FIX_SECRET --> AUDIT_CHECK
  AUDIT_CHECK -->|없음| FIX_AUDIT[auditLog 추가\nCSAP D-06 요건]
  AUDIT_CHECK -->|있음| N2SF_CHECK{AI 기능이 있다면\nN2SF 등급 확인\n및 PII 마스킹?}

  FIX_AUDIT --> N2SF_CHECK
  N2SF_CHECK -->|미확인| FIX_N2SF[데이터 등급 확인\nC·S등급 전송 차단]
  N2SF_CHECK -->|확인 완료| LOCAL_TEST[로컬 검증 실행\npnpm typecheck + lint + test]

  FIX_N2SF --> LOCAL_TEST
  LOCAL_TEST -->|실패| FIX_LOCAL[오류 수정]
  LOCAL_TEST -->|통과| AUDIT_JSONL_CHECK{.claude/audit.jsonl\n파일 존재 확인}

  FIX_LOCAL --> AUDIT_JSONL_CHECK
  AUDIT_JSONL_CHECK -->|없음| CREATE_AUDIT[audit.jsonl 생성\n또는 Q-Gate G7 확인]
  AUDIT_JSONL_CHECK -->|있음| PR_READY[PR 제출 준비 완료\nQ-Gate 빠른 통과 예상]

  CREATE_AUDIT --> PR_READY
```

**체크리스트 항목별 Q-Gate 연결**:

| 점검 항목 | 위반 시 실패 게이트 | 자동 탐지 도구 |
|---------|-----------------|-------------|
| RBAC (verifyToken + hasPermission) | Reviewer 에이전트 HIGH 플래그 | 코드 리뷰 |
| Zod 스키마 입력 검증 | Q-Gate G5 (OWASP) | Semgrep |
| 파라미터화 쿼리 | Q-Gate G5 (OWASP) | Semgrep + G5 패턴 탐지 |
| 하드코딩 시크릿 없음 | Q-Gate G5 (OWASP) + Secret Scan | CI Secret Scan + G5 |
| 감사 로그 (auditLog) | Q-Gate G7 (감사 추적) | audit.jsonl 확인 |
| N2SF AI 연동 등급 | 런타임 BLOCKED 에러 | sendToAI() 내장 검사 |
| audit.jsonl 존재 | Q-Gate G7 (감사 로그) | quality-gate.yml |

### 9.1 코드 보안 체크리스트

```
[ ] RBAC 검사
    - 새로 추가한 API 엔드포인트에 verifyToken() 호출이 있는가?
    - hasPermission() 검사가 포함되어 있는가?
    - 인증 없이 접근 가능한 엔드포인트가 의도적인 것인지 확인했는가?

[ ] 입력 검증
    - 모든 API 요청 body에 Zod 스키마 검증이 적용되었는가?
    - URL 파라미터도 Zod로 검증하는가?
    - 검증 실패 시 400 Bad Request를 반환하는가?

[ ] SQL 주입 방지
    - SQL 쿼리에 문자열 직접 결합이 없는가?
    - 모든 쿼리가 파라미터화 쿼리($1, $2)를 사용하는가?

[ ] 하드코딩 금지
    - API 키, 비밀번호, 토큰이 코드에 직접 포함되어 있지 않은가?
    - 모든 시크릿이 process.env.*로 참조되는가?

[ ] 에러 처리
    - catch 블록에서 스택 트레이스가 외부에 노출되지 않는가?
    - 에러 메시지에 DB 정보, 내부 경로가 포함되지 않는가?
    - 에러 ID가 포함된 안전한 에러 응답을 반환하는가?

[ ] 암호화
    - 민감 데이터 저장 시 encrypt() 함수를 사용하는가?
    - 비밀번호는 bcrypt(cost 12)로 해시하는가?
```

### 9.2 감사 로그 체크리스트

```
[ ] 감사 로그 대상 작업 확인
    - 새로 추가한 기능이 사용자 데이터 생성/수정/삭제를 포함하는가?
    - 포함한다면 auditLog() 호출이 추가되었는가?
    - auditLog()에 actor, action, target, timestamp, ip가 포함되었는가?

[ ] audit.jsonl 존재 확인
    - .claude/audit.jsonl 파일이 존재하는가?
    - 파일이 유효한 JSONL 형식인가?
```

### 9.3 N2SF 데이터 등급 체크리스트

```
[ ] AI API 연동 확인 (AI 기능이 있는 경우)
    - 전송하는 데이터의 N2SF 등급을 확인했는가?
    - C/S 등급 데이터가 AI에 전송되지 않는가?
    - O 등급 데이터에 PII 마스킹이 적용되었는가?
    - 외부 AI API를 직접 호출하지 않고 AI Gateway를 경유하는가?
```

### 9.4 빠른 자가 점검 명령어

PR 제출 전 로컬에서 실행하십시오.

```bash
# 1. 타입 검사
pnpm run typecheck

# 2. 린트
pnpm run lint

# 3. 테스트 (커버리지 포함)
pnpm run test -- --coverage

# 4. 하드코딩 시크릿 자가 점검
grep -rn --include="*.ts" --include="*.tsx" \
  -E "(sk-[a-zA-Z0-9]{20,}|password\s*=\s*['\"][^'\"]+['\"])" \
  platform/ | grep -v "process.env" | grep -v ".test." | grep -v ".spec."

# 5. SQL 직접 결합 자가 점검
grep -rn --include="*.ts" \
  -E "SELECT.*\\\$\{|INSERT.*\\\$\{|DELETE.*\\\$\{" \
  platform/services/ | grep -v ".test."

# 6. Semgrep 자가 점검 (설치된 경우)
semgrep scan --config "p/owasp-top-ten" platform/ 2>/dev/null | grep "ERROR"

# 7. audit.jsonl 확인
[ -f .claude/audit.jsonl ] && echo "OK" || echo "MISSING: audit.jsonl 파일 없음"
tail -3 .claude/audit.jsonl | jq . 2>/dev/null || echo "형식 오류 확인 필요"
```

모든 체크를 통과한 후 PR을 제출하면 Q-Gate에서도 빠르게 통과할 수 있습니다.

---

## 부록 A: 보안 관련 참조 문서

| 문서 | 위치 | 용도 |
|------|------|------|
| CSAP 준수 규칙 | `.claude/rules/csap-compliance.md` | 코드 레벨 보안 패턴 |
| CI/CD 보안 파이프라인 | `docs/security/cicd-security-pipeline.md` | 파이프라인 보안 구성 |
| 의존성 감사 가이드 | `docs/security/dependency-audit-guide.md` | pnpm audit 사용법 |
| Trivy 이미지 스캔 | `docs/security/trivy-image-scan-guide.md` | 컨테이너 취약점 스캔 |
| SLSA L3 체크리스트 | `docs/security/slsa-l3-checklist.md` | 빌드 증명 검증 |
| OWASP ZAP 가이드 | `docs/security/owasp-zap-dast-guide.md` | 동적 보안 테스트 |
| 감사 리포트 템플릿 | `docs/security/audit-report-template.md` | 감사 보고서 작성 |

## 부록 B: 보안 담당자 연락처

| 역할 | 연락처 | 상황 |
|------|--------|------|
| 보안팀 | `security@saas.local` | 취약점 신고, 사고 보고 |
| CSAP 담당 | `csap@saas.local` | CSAP 준수 문의 |
| 개인정보보호 | `privacy@saas.local` | 개인정보 관련 사고 |
| 긴급 보안 | Slack `#security-incident` | 즉각 대응 필요 상황 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 (csap-compliance.md + 실제 파이프라인 기반) | Implementer Agent |
| 1.1.0 | 2026-04-11 | Mermaid 다이어그램 6종 추가: CSAP 13개 도메인 mindmap·API 보안 처리 시퀀스·N2SF 데이터 흐름·감사 로그 체인 무결성·보안 사고 대응 플로우·PR 체크리스트 플로우차트. 각 섹션 보안 위반 사례 vs 올바른 패턴 대조표 추가 | Implementer Agent |
