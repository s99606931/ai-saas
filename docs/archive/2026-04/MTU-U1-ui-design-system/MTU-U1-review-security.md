# MTU-U1 보안 검토 보고서 (CSAP/N2SF)

| 항목 | 결과 |
|------|------|
| 검토일 | 2026-04-05 |
| 검토자 | Security Reviewer (claude-sonnet-4-6) |
| 검토 대상 | MTU-U1-impl-S1S2-tokens-layout.md, MTU-U1-impl-S3-tenant-ai.md, MTU-U1-impl-S4-dnd-a11y-storybook.md |
| 기준 | CSAP 79항목 + N2SF 6영역 + OWASP Top 10 (2021) |
| 발견 이슈 | 6개 (CRITICAL: 2, HIGH: 3, MED: 1) |
| CSAP D-06 감사 로그 | PARTIAL — 운영 환경 DB 미구현 (콘솔 출력으로 대체됨) |
| N2SF 데이터 등급 검증 | PASS — 클라이언트+서버 이중 검증 구현 확인 |
| 전체 판정 | **FAIL** — CRITICAL 이슈 2건 차단 필요 |

---

## CRITICAL 이슈 (즉시 차단)

### [CRITICAL-1] 운영 환경 감사 로그 미구현 — CSAP D-06 위반

**파일**: `lib/audit/audit-logger.ts` (S3 문서, §3 감사 로그 통합)
**CSAP 항목**: D-06 침해사고 관리 (감사 로그 보존 1년 이상 필수)

**문제 패턴**:

```typescript
// 운영 환경: DB 기록 (prisma.auditLog.create — Phase 2 구현 예정)
// NOTE: 미사용. Phase 2 DB 감사 로그 구현 시 활성화 예정 (FR-2.x).
console.log('[AUDIT]', JSON.stringify(record))
```

**위험**: 운영(`NODE_ENV === 'production'`) 환경에서 `TENANT_THEME_UPDATE`, `AI_CHAT_REQUEST`, `AI_CHAT_BLOCKED_N2SF` 등 모든 민감 작업 감사 로그가 콘솔 출력으로만 처리된다. 컨테이너/Pod 재시작 시 로그 유실이 발생하며, CSAP D-06이 요구하는 1년 보존, append-only 무결성, 수정 불가 구조를 충족하지 못한다. 이 상태로 운영에 진입하면 CSAP 인증 심사 결함 처리된다.

**조치 (구현 착수 전 설계 필요)**:

```typescript
// 운영 환경 감사 로그: Prisma audit_logs 테이블 사용 필수
if (process.env.NODE_ENV === 'production') {
  await prisma.auditLog.create({
    data: {
      id: record.id,
      timestamp: new Date(record.timestamp),
      actor: record.actor,
      action: record.action,
      target: record.target,
      metadata: record.metadata ?? {},
      ip: record.ip,
      userAgent: record.userAgent,
    },
  })
  return
}
```

Prisma 스키마에 `AuditLog` 모델(append-only — DELETE 권한 없는 DB 역할 사용)을 추가하고, Phase 2가 아닌 현재 Phase에서 구현해야 한다. CSAP D-06은 단계적 구현 예외를 허용하지 않는다.

---

### [CRITICAL-2] 대시보드 레이아웃 API 인증 헤더 누락 — A01 접근 통제 실패

**파일**: `stores/dashboard-store.ts` (S4 문서, §1.1.5)
**OWASP**: A01 접근 통제 실패 / CSAP D-08 접근 통제

**문제 패턴**:

```typescript
// saveLayout
const response = await fetch('/api/user/dashboard-layout', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ widgets: get().widgets }),
})

// loadLayout
const response = await fetch(`/api/user/dashboard-layout?userId=${userId}`)
```

**위험**: 두 API 호출 모두 `Authorization` 헤더를 포함하지 않는다. 서버 측 `/api/user/dashboard-layout` Route Handler에 인증 검사가 있더라도, 이 클라이언트 코드는 쿠키 인증(httpOnly)에만 의존한다는 가정을 전제한다. 그러나 설계 문서 어디에도 해당 API Route Handler의 `verifyToken` 호출이 명시되지 않았다. 또한 `loadLayout`의 `?userId=${userId}` 쿼리 파라미터는 사용자가 다른 사용자의 레이아웃을 조회할 수 있는 IDOR(Insecure Direct Object Reference) 위험을 가진다.

**조치**:

```typescript
// saveLayout: JWT를 헤더에 포함하거나, 서버 API Route에서
// 반드시 verifyToken(request.headers.get('Authorization'))으로 사용자 확인
const response = await fetch('/api/user/dashboard-layout', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getAccessToken()}`,
  },
  body: JSON.stringify({ widgets: get().widgets }),
})

// loadLayout: userId를 쿼리 파라미터로 전달하지 말 것.
// 서버에서 토큰으로 userId를 확인하여 자기 데이터만 조회하도록 설계해야 함.
const response = await fetch('/api/user/dashboard-layout', {
  headers: { 'Authorization': `Bearer ${getAccessToken()}` },
})
```

서버 Route Handler도 반드시 명시: `verifyToken` 호출 후 JWT 내 `userId`로만 데이터 조회.

---

## HIGH 이슈

### [HIGH-1] fontFamily Zod 스키마 미검증 — CSS 주입 가능성

**파일**: `app/api/tenant/theme/route.ts` (S3 문서, §1.4)
**OWASP**: A03 주입

**문제 패턴**:

```typescript
// Zod 스키마 — fontFamily 검증 없음
fontFamily: z.string().max(200).optional().nullable(),
```

CSS 생성기(`sanitizeFontFamily`)는 `ALLOWED_FONT_FAMILIES` 허용 목록으로 2차 검증을 수행하지만, API 입력 스키마 계층에서 정규식 검증이 없다. `sanitizeFontFamily`가 허용 목록 불일치 시 기본값으로 대체(silent fallback)하는 로직은 오류를 숨기며, 공격자가 의도적으로 비정상 값을 반복 투입해 기본값 강제 효과를 노릴 수 있다. 더 나아가 CSS 허용 목록 검사에서 `value.includes(allowed.replace(/'/g, ''))` 방식은 부분 문자열 포함 확인이므로, 예를 들어 `"Noto Sans KR; background:url(evil)"` 같은 값이 `includes` 확인을 통과할 수 있다.

**조치**:

```typescript
// Zod 스키마에 허용 폰트 목록 열거형 직접 적용
fontFamily: z.enum([
  "'Noto Sans KR'",
  "'Malgun Gothic'",
  "'Apple SD Gothic Neo'",
  "Gungsuh",
  "'Nanum Gothic'",
  "'Nanum Myeongjo'",
  "system-ui",
]).optional().nullable(),
```

`sanitizeFontFamily`의 `includes` 검사도 `===` 완전 일치 비교로 교체해야 한다:

```typescript
const isAllowed = ALLOWED_FONT_FAMILIES.some((allowed) => allowed === value)
```

---

### [HIGH-2] 로고 URL SSRF(Server-Side Request Forgery) 위험

**파일**: `components/admin/theme-configurator.tsx` (S3 문서, §1.6) 및 Prisma 스키마 `logoUrl`
**OWASP**: A10 서버측 요청 위조 (2021 신규)

**문제 패턴**:

```typescript
// 클라이언트 폼 — logoUrl은 z.string().url()만 적용
logoUrl: z.string().url().max(500).optional().nullable(),

// 컴포넌트 — URL 미리보기를 <img>로 직접 렌더링
<img
  src={form.watch('logoUrl')}
  alt={form.watch('logoAltText') || '로고 미리보기'}
  className="max-h-12 max-w-40 object-contain"
/>
```

`z.string().url()` 검증은 `http://internal-server/admin`, `file:///etc/passwd`, `http://169.254.169.254/metadata` 등의 값을 유효 URL로 통과시킨다. 로고 URL이 서버에서 처리(예: 이미지 리사이즈, 썸네일 생성, CDN 업로드)되는 경우 SSRF 공격이 가능하다. 클라이언트에서의 `<img src>` 렌더링도 내부 서비스 포트 스캐닝에 악용될 수 있다.

**조치**:

```typescript
// Zod 스키마에 도메인 화이트리스트 추가
logoUrl: z.string()
  .url()
  .max(500)
  .refine(
    (url) => {
      try {
        const parsed = new URL(url)
        const allowedHosts = (process.env.ALLOWED_LOGO_DOMAINS ?? '').split(',')
        return (
          parsed.protocol === 'https:' &&
          allowedHosts.some((host) => parsed.hostname === host.trim())
        )
      } catch { return false }
    },
    { message: '허용되지 않는 로고 도메인입니다' }
  )
  .optional()
  .nullable(),
```

환경변수 `ALLOWED_LOGO_DOMAINS`에 허용 도메인(기관 CDN 등)을 명시적으로 나열해야 한다.

---

### [HIGH-3] CSP 'unsafe-inline' 허용 범위 과다 — XSS 방어막 약화

**파일**: `next.config.ts` (S1 문서, §1.2)
**OWASP**: A05 보안 설정 오류

**문제 패턴**:

```typescript
"script-src 'self' 'unsafe-inline'",   // 인라인 스크립트(FOUC 방지)만 허용
"style-src 'self' 'unsafe-inline'",
```

`'unsafe-inline'`을 `script-src`와 `style-src` 모두에 전역 허용하면 XSS 공격이 성공할 경우 임의 스크립트/스타일 실행이 가능해져 CSP의 핵심 방어 효과가 무력화된다. FOUC 방지 인라인 스크립트는 nonce 기반으로 제한할 수 있다.

**조치**:

Next.js 15의 nonce 기반 CSP 활용:

```typescript
// next.config.ts — nonce 기반 CSP (Next.js 15 지원)
{
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    "script-src 'self' 'nonce-{NONCE}'",   // nonce는 미들웨어에서 주입
    "style-src 'self' 'unsafe-inline'",     // Tailwind inline style은 유지 불가피
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src 'none'",                     // iframe 완전 차단 추가 권장
  ].join('; '),
},
```

FOUC 방지 스크립트(`ThemeInitScript`)는 nonce를 props로 전달받아 `<script nonce={nonce}>` 형태로 변경해야 한다.

---

## MEDIUM 이슈

### [MED-1] x-tenant-id 헤더 신뢰 모델 설계 명세 부재

**파일**: `app/api/tenant/theme/route.ts` (S3 문서, §1.4), `middleware.ts` (S3 문서, §1.5)
**OWASP**: A01 접근 통제 실패

**문제 패턴**:

```typescript
// GET /api/tenant/theme
const tenantId = request.headers.get('x-tenant-id')
if (!tenantId) {
  return NextResponse.json({ error: '테넌트 ID가 없습니다' }, { status: 400 })
}
// tenantId를 그대로 DB 쿼리에 사용
const theme = await prisma.tenantTheme.findFirst({
  where: { tenantId, isActive: true },
})
```

미들웨어가 `x-tenant-id`를 주입하지만, 외부 클라이언트가 이 헤더를 직접 조작해서 보낼 수 있다. Next.js 미들웨어는 신뢰할 수 없는 요청 헤더를 차단하지 않으므로, 공격자가 임의의 `x-tenant-id` 값을 설정해 다른 기관 테마 데이터에 접근할 가능성이 있다.

**조치**: API Route Handler에서 JWT 토큰 내의 테넌트 정보와 `x-tenant-id` 헤더 값을 교차 검증해야 한다. 또는 미들웨어에서 서명된 내부 시크릿을 추가해 외부 위조를 차단해야 한다.

```typescript
// verifyToken 반환 user 객체에 tenantId 포함 권장
const user = await verifyToken(request.headers.get('Authorization'))
if (!user) { ... }

// x-tenant-id 헤더가 JWT 내 tenantId와 일치하는지 검증
const headerTenantId = request.headers.get('x-tenant-id')
if (headerTenantId !== user.tenantId) {
  return NextResponse.json({ error: '테넌트 불일치' }, { status: 403 })
}
```

---

## 긍정적 보안 패턴

다음 보안 패턴은 공공기관 SaaS 표준으로 우수하게 구현되었다.

**1. N2SF 이중 검증 (클라이언트 + 서버)**
`lib/n2sf/data-grade-validator.ts`의 `validateForAI()`가 클라이언트(`use-ai-chat.ts`)와 서버(`app/api/ai/chat/route.ts`) 양쪽에서 모두 호출된다. 서버는 C/S등급 요청에 422 상태와 `DATA_GRADE_BLOCKED` 오류 코드로 응답하며 감사 로그도 기록한다. N2SF N-05 요건을 정확하게 충족한다.

**2. CSS 값 서버측 정규식 검증**
`lib/theme/css-generator.ts`의 `sanitizeColorValue()`와 `sanitizeSizeValue()`가 oklch/hsl/hex/rgb 형식과 rem/px/em 값을 정규식으로 강제 검증한다. 색상 주입 공격의 주된 경로를 차단한다.

**3. 모든 테마 API에 RBAC 적용**
`GET /api/tenant/theme`는 인증 확인, `PUT /api/tenant/theme`는 `hasPermission(user, 'tenant:theme:write')` 권한 검사를 추가로 적용한다. CSAP D-08 요건을 준수한다.

**4. 안전한 에러 응답**
AI 채팅 API의 `catch` 블록에서 `errorId`만 응답하고 스택 트레이스 및 에러 상세를 노출하지 않는다. CSAP D-12 요건에 부합한다.

**5. SQL 주입 방지**
모든 DB 조회가 Prisma ORM의 매개변수화 쿼리를 사용한다. 원시 쿼리(`$queryRaw`, `$executeRaw`) 사용이 없다.

**6. 보안 헤더 기본 설정**
`next.config.ts`에 `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `X-XSS-Protection`, `Content-Security-Policy`가 전역 적용된다. CSAP D-08, D-09 요건을 충족한다.

**7. 하드코딩 시크릿 없음**
`apiKey: 'not-required'`는 LM Studio 로컬 전용 플레이스홀더로 실제 시크릿이 아니다. 모든 민감 값이 `process.env.*`를 통해 참조된다.

**8. PII 마스킹**
`maskPII()` 함수가 주민등록번호, 전화번호, 이메일을 AI API 전송 전 서버측에서 재마스킹한다.

**9. 도메인 캐시 Cache-Poisoning 방지**
`domain-resolver.ts`의 인메모리 캐시는 도메인 키로만 조회하며 외부 입력이 캐시 키 외에 주입될 경로가 없다.

**10. `dangerouslySetInnerHTML` 사용 정당성 확인**
`ThemeInitScript` 컴포넌트의 `dangerouslySetInnerHTML` 사용은 외부 입력 없이 코드 내 정의된 리터럴 스크립트만 포함하므로 XSS 위험 없음. 주석으로 이유가 명시되어 있다.

---

## CSAP 항목별 준수 현황

| CSAP 항목 | 항목명 | 준수 여부 | 비고 |
|-----------|--------|-----------|------|
| D-06 | 침해사고 관리 — 감사 로그 | **PARTIAL** | 개발 환경 파일 로그는 구현. 운영 환경 DB 로그 미구현 → **CRITICAL-1** |
| D-08 | 접근 통제 — API 인증 | **PARTIAL** | 테마/AI API는 준수. 대시보드 레이아웃 API 인증 누락 → **CRITICAL-2** |
| D-08 | 접근 통제 — RBAC 권한 | PASS | `hasPermission()` 적용 확인 |
| D-08 | 접근 통제 — 테넌트 격리 | **PARTIAL** | x-tenant-id 헤더 교차 검증 미비 → **MED-1** |
| D-09 | 암호화 — 전송 | PASS | HSTS 헤더 적용, TLS 1.3+ 의도 |
| D-09 | 암호화 — 보안 헤더 | PASS | CSP/HSTS/X-Content-Type-Options 설정 |
| D-09 | 암호화 — CSP 강도 | **PARTIAL** | unsafe-inline 과다 허용 → **HIGH-3** |
| D-12 | 시스템 개발 보안 — 입력 검증 | **PARTIAL** | 색상/크기 검증 우수. fontFamily 검증 미비 → **HIGH-1** |
| D-12 | 시스템 개발 보안 — SQL 주입 | PASS | Prisma 매개변수화 쿼리 전용 사용 |
| D-12 | 시스템 개발 보안 — 에러 노출 | PASS | errorId만 응답, 스택 트레이스 미노출 |
| D-12 | 시스템 개발 보안 — 하드코딩 시크릿 | PASS | 환경변수 전용 사용 확인 |

---

## N2SF 영역별 준수 현황

| N2SF 영역 | 준수 여부 | 비고 |
|-----------|-----------|------|
| N-05 AI API 데이터 등급 통제 | PASS | 클라이언트+서버 이중 검증 구현 확인 |
| N-05 PII 마스킹 | PASS | 클라이언트 및 서버측 재마스킹 |
| N-03 시스템 격리 (테넌트) | PARTIAL | x-tenant-id 신뢰 모델 명세 보완 필요 |
| N-01 계정 관리 | 검토 대상 외 | 별도 인증 모듈에서 확인 필요 |

---

## OWASP Top 10 (2021) 준수 현황

| OWASP | 항목 | 판정 | 근거 |
|-------|------|------|------|
| A01 | 접근 통제 실패 | **FAIL** | 대시보드 API 인증 누락(CRITICAL-2), 테넌트 헤더 교차검증 미비(MED-1) |
| A02 | 암호화 실패 | PASS | 보안 헤더 설정, 환경변수 관리 |
| A03 | 주입 | PARTIAL | fontFamily CSS 주입(HIGH-1), SQL 주입은 방지 |
| A04 | 안전하지 않은 설계 | PARTIAL | SSRF 도메인 화이트리스트 미비(HIGH-2) |
| A05 | 보안 설정 오류 | PARTIAL | CSP unsafe-inline 과다(HIGH-3) |
| A06 | 취약하고 오래된 구성요소 | 검토 보류 | npm audit 별도 실행 필요 |
| A07 | 인증/세션 관리 실패 | PARTIAL | verifyToken 적용 확인. JWT 구현 상세 미포함 |
| A08 | 소프트웨어 무결성 실패 | 해당 없음 | — |
| A09 | 보안 로깅 실패 | **FAIL** | 운영 환경 감사 로그 미구현(CRITICAL-1) |
| A10 | 서버측 요청 위조 | **FAIL** | logoUrl SSRF 방지 미비(HIGH-2) |

---

## 조치 우선순위 요약

| 우선순위 | 이슈 ID | 내용 | 담당 파일 |
|----------|---------|------|-----------|
| 1 (즉시) | CRITICAL-1 | 운영 환경 감사 로그 DB 구현 | `lib/audit/audit-logger.ts`, `prisma/schema.prisma` |
| 2 (즉시) | CRITICAL-2 | 대시보드 레이아웃 API 인증 추가 + IDOR 방지 | `stores/dashboard-store.ts`, `app/api/user/dashboard-layout/route.ts` |
| 3 (고) | HIGH-1 | fontFamily 스키마 열거형 검증 + sanitizeFontFamily 완전 일치 비교 | `app/api/tenant/theme/route.ts`, `lib/theme/css-generator.ts` |
| 4 (고) | HIGH-2 | logoUrl SSRF 방지 도메인 화이트리스트 | `app/api/tenant/theme/route.ts` |
| 5 (고) | HIGH-3 | CSP script-src nonce 기반으로 교체 | `next.config.ts`, `components/ui/theme-init-script.tsx` |
| 6 (중) | MED-1 | x-tenant-id 헤더 JWT 교차 검증 설계 명세 | `app/api/tenant/theme/route.ts`, `app/api/ai/chat/route.ts` |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | MTU-U1 Session 1+2+3+4 보안 검토 최초 작성 | Security Reviewer |
