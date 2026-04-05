# MTU-U1 보안 재검토 보고서

| 항목 | 내용 |
|------|------|
| 재검토일 | 2026-04-05 |
| 재검토자 | Security Reviewer (claude-sonnet-4-6) |
| 검토 대상 | docs/02-design/mtus/MTU-U1-impl-S3-tenant-ai.md, docs/02-design/mtus/MTU-U1-impl-S4-dnd-a11y-storybook.md |
| 원본 보안 검토 | docs/archive/2026-04/MTU-U1-ui-design-system/MTU-U1-review-security.md |
| 전체 판정 | **CONDITIONAL PASS** — CRITICAL-1 + HIGH-1 + HIGH-2 미해결, 즉시 조치 필요 |

---

## Executive Summary

이전 보안 검토에서 발견된 CRITICAL 2건, HIGH 3건 중 1건(CRITICAL-2)만 해결되었다.
CRITICAL-1, HIGH-1, HIGH-2는 수정되지 않았으며, 이 중 CRITICAL-1(운영 환경 감사 로그 미구현)은
CSAP D-06 인증 심사 결함 처리 기준에 해당한다. HIGH-3(CSP unsafe-inline)은 이번 배치에
포함되지 않았음을 확인했다. 신규 이슈는 발견되지 않았다.

---

## CRITICAL 이슈 해결 여부

| 이슈 | 결과 | 비고 |
|------|------|------|
| CRITICAL-1 운영 환경 감사 로그 DB 미구현 | **미해결** | 아래 상세 참조 |
| CRITICAL-2 대시보드 API 인증 헤더 누락 + IDOR | **해결** | 아래 상세 참조 |

### CRITICAL-1 — 운영 환경 감사 로그 미구현 (미해결)

**파일 상태**: `docs/02-design/mtus/MTU-U1-impl-S3-tenant-ai.md` 파일이 존재하지 않는다.
해당 경로에 수정본이 배치되지 않았으며, 아카이브 원본
(`docs/archive/2026-04/MTU-U1-ui-design-system/MTU-U1-impl-S3-tenant-ai.md`)만 존재한다.

아카이브 파일 `lib/audit/audit-logger.ts` 섹션(라인 2707-2709)은 이전 검토 지적 그대로 유지되고 있다.

```typescript
// 운영 환경: DB 기록 (prisma.auditLog.create — Phase 2 구현 예정)
// NOTE: 미사용. Phase 2 DB 감사 로그 구현 시 활성화 예정 (FR-2.x).
console.log('[AUDIT]', JSON.stringify(record))
```

추가 확인 사항:
- `prisma/schema.prisma`에 `AuditLog` 모델 추가 없음 (기존 스키마에 Tenant, TenantTheme,
  TenantThemeHistory, TenantDomain 모델만 존재)
- `NODE_ENV === 'production'` 분기에서 `prisma.auditLog.create()` 호출 없음
- CSAP D-06 요건(1년 보존, append-only 무결성, 수정 불가 구조)을 운영 환경에서 충족하지 못함

**판정**: 미해결. CSAP 인증 심사 결함 처리 기준에 해당한다.

### CRITICAL-2 — 대시보드 레이아웃 API 인증 헤더 누락 + IDOR (해결)

**파일**: `docs/02-design/mtus/MTU-U1-impl-S4-dnd-a11y-storybook.md`

`stores/dashboard-store.ts` 섹션(라인 880-956) 확인 결과:

`saveLayout`에 `Authorization: Bearer ${token}` 헤더가 추가되었다.

```typescript
...(token ? { 'Authorization': `Bearer ${token}` } : {}),
```

`loadLayout`에서 `?userId=` 쿼리 파라미터가 제거되었고, `Authorization` 헤더를 사용하며
명시적 IDOR 방지 주석이 추가되었다.

```typescript
// IDOR 방지: userId를 쿼리 파라미터로 전달하지 않음
// 서버에서 JWT 토큰 내 userId를 추출하여 자기 데이터만 조회
const response = await fetch('/api/user/dashboard-layout', {
  headers: {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  },
})
```

서버 응답 데이터에 Zod 런타임 스키마 검증(`layoutResponseSchema.safeParse`)도 추가되어
응답 무결성 확인이 추가되었다.

**판정**: 해결. 단, 토큰이 localStorage에 없을 때 `Authorization` 헤더가 누락되므로
서버 측 Route Handler에서 반드시 `verifyToken` 호출로 인증 실패 처리가 되어야 함을 주의한다.
(서버 구현 명세는 현재 검토 범위 외)

---

## HIGH 이슈 해결 여부

| 이슈 | 결과 | 비고 |
|------|------|------|
| HIGH-1 fontFamily CSS 주입 방지 미흡 | **미해결** | 아래 상세 참조 |
| HIGH-2 logoUrl SSRF 방지 미구현 | **미해결** | 아래 상세 참조 |
| HIGH-3 CSP unsafe-inline | **이번 배치 미포함** | 아래 상세 참조 |

### HIGH-1 — fontFamily CSS 주입 방지 (미해결)

**파일**: `lib/audit/audit-logger.ts` — S3 아카이브 파일만 존재, 활성 파일 없음

API 스키마(`updateThemeSchema`) 라인 435에서 여전히 `z.string().max(200)`을 사용한다.

```typescript
fontFamily: z.string().max(200).optional().nullable(),
```

권고된 `z.enum([...])` 허용 폰트 목록 열거형으로 교체되지 않았다.

`sanitizeFontFamily` 함수(라인 207-208)에서도 여전히 `value.includes(...)` 부분 문자열 비교를 사용한다.

```typescript
const isAllowed = ALLOWED_FONT_FAMILIES.some(
  (allowed) => value.includes(allowed.replace(/'/g, ''))
)
```

`"Noto Sans KR; background:url(evil)"` 같은 값이 `includes` 검사를 통과할 수 있는 취약점이
그대로 남아 있다. 권고된 `===` 완전 일치 비교로 교체되지 않았다.

**판정**: 미해결.

### HIGH-2 — logoUrl SSRF 방지 (미해결)

**파일**: S3 아카이브 라인 451

```typescript
logoUrl: z.string().url().max(500).optional().nullable(),
```

권고된 `.refine()` 도메인 화이트리스트 검증 및 HTTPS 프로토콜 강제가 추가되지 않았다.
`http://169.254.169.254/metadata`, `http://internal-server/admin` 등 내부 주소가 여전히
유효 URL로 통과된다.

**판정**: 미해결.

### HIGH-3 — CSP 'unsafe-inline' 허용 범위 과다 (이번 배치 미포함)

작업 요청에 명시된 대로 이번 수정 배치에 포함되지 않았다. `next.config.ts` 파일을 검토하지
않았으므로 현재 상태를 판정하지 않는다. 다음 수정 배치에서 반드시 포함해야 한다.

---

## 잔여 이슈 요약 (즉시 조치 필요)

| ID | 심각도 | 파일 | 조치 내용 |
|----|--------|------|---------|
| CRITICAL-1 | CRITICAL | `lib/audit/audit-logger.ts` | `NODE_ENV === 'production'` 분기에서 `prisma.auditLog.create()` 구현. Prisma 스키마에 `AuditLog` 모델(append-only, DELETE 권한 없는 DB 역할) 추가. |
| HIGH-1 | HIGH | `app/api/tenant/theme/route.ts` | `fontFamily` Zod 스키마를 `z.enum([...])` 허용 목록으로 교체. `sanitizeFontFamily`의 `includes` 비교를 `===` 완전 일치로 교체. |
| HIGH-2 | HIGH | `app/api/tenant/theme/route.ts`, `components/admin/theme-configurator.tsx` | `logoUrl`에 `.refine()` 도메인 화이트리스트(`ALLOWED_LOGO_DOMAINS` 환경변수) + `protocol === 'https:'` 강제 추가. |
| HIGH-3 | HIGH | `next.config.ts` | `script-src`에서 `unsafe-inline`을 제거하고 nonce 기반 CSP로 교체. |

---

## 신규 발견 이슈

없음. 수정 과정에서 도입된 새로운 보안 문제는 발견되지 않았다.

CRITICAL-2 수정 시 토큰이 없을 때(`token === null`) `Authorization` 헤더가 전송되지 않는
로직이 존재한다. 이 경우 서버가 401을 반환해야 하며, 클라이언트가 조용히 실패(silent failure)
하는 현재 처리(`if (!response.ok) return`)는 레이아웃을 영구 로드하지 않을 수 있으나
보안 취약점은 아니다. 다만 사용자 경험 측면에서 에러 알림 처리를 권고한다.

---

## 최종 판정

**CONDITIONAL PASS**

CRITICAL-2는 올바르게 해결되었다. 그러나 CRITICAL-1(운영 환경 감사 로그 DB 미구현)이
미해결 상태이며, 이는 CSAP D-06 인증 심사 결함 항목에 해당한다. 해당 이슈가 해결되기 전까지
운영 환경 배포는 금지한다. HIGH-1, HIGH-2도 다음 수정 사이클에서 반드시 처리해야 하며,
HIGH-3(CSP)는 다음 배치에 포함할 것을 요청한다.

수정 완료 후 3차 재검토를 수행해야 한다.

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 초안 작성 — 2차 보안 재검토 | Security Reviewer |
