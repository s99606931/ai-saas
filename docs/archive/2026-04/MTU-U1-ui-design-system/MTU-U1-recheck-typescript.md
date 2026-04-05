# MTU-U1 TypeScript 재검토 보고서

| 항목 | 내용 |
|------|------|
| 재검토일 | 2026-04-05 |
| 검토 대상 S3 | `docs/archive/2026-04/MTU-U1-ui-design-system/MTU-U1-impl-S3-tenant-ai.md` |
| 검토 대상 S4 | `docs/02-design/mtus/MTU-U1-impl-S4-dnd-a11y-storybook.md` |
| 전체 판정 | **CONDITIONAL PASS** |

> **전제 조건**: 두 파일은 구현 가이드 문서(코드 스니펫 포함)이며, 실제 소스 파일이 아닙니다.
> TypeScript 컴파일러(`tsc --noEmit`) 및 ESLint를 직접 실행할 수 있는 소스 파일이 존재하지 않으므로
> 정적 분석 도구는 실행하지 않고 코드 스니펫 검토로 범위를 한정합니다.

---

## HIGH 이슈 해결 현황

| 이슈 ID | 내용 | 해결 | 비고 |
|---------|------|------|------|
| HIGH-01 | `as unknown as Record<string, unknown>` 이중 단언 | ❌ | 미해결 — 동일 패턴 존재 |
| HIGH-02 | `get().saveLayout()` floating Promise | ✅ | `.catch()` + `saveError` 상태 기록으로 해결 |
| HIGH-03 | `generateTenantCSS` 단일 try/catch | ❌ | 미해결 — 항목별 독립 처리 미적용 |
| HIGH-04 | `useCallback` 의존성 배열에 `chat` 전체 | ❌ | 미해결 — `[validation, chat, onError]` 그대로 |
| HIGH-05 | `loadLayout` API 응답 Zod `safeParse` 검증 | ✅ | `layoutResponseSchema.safeParse(data)` 적용 |
| HIGH-06 | `sanitizedMessages as UIMessage[]` 단언 | ❌ | 미해결 — 동일 캐스팅 존재 |

---

## 이슈별 상세

### HIGH-01 — 미해결

**위치**: `docs/archive/2026-04/MTU-U1-ui-design-system/MTU-U1-impl-S3-tenant-ai.md`, `app/api/tenant/theme/route.ts` 스니펫, 약 536행

**코드**:
```typescript
themeSnapshot: existing as unknown as Record<string, unknown>,
```

**문제**: Prisma 모델 객체(`TenantTheme`)를 `unknown`으로 먼저 브로드닝한 뒤 `Record<string, unknown>`으로 재단언하는 이중 단언입니다. Prisma의 `Json` 필드 타입(`Prisma.InputJsonValue`)이 요구하는 직렬화 가능 표현으로 변환하지 않고 타입 시스템을 강제로 우회합니다.

**권장 수정**:
```typescript
themeSnapshot: JSON.parse(JSON.stringify(existing)) as Prisma.InputJsonValue,
```
`JSON.parse(JSON.stringify(...))` 는 날짜 등 직렬화 불가 필드를 제거하여 실제 런타임 안전성도 확보합니다.

---

### HIGH-03 — 미해결

**위치**: `MTU-U1-impl-S3-tenant-ai.md`, `lib/theme/css-generator.ts` 스니펫, 약 234–296행

**문제**: `generateTenantCSS` 함수는 9개 항목(colorPrimary, colorSecondary, colorAccent, colorSidebar, colorHeader, fontFamily, fontSizeBase, borderRadius, sidebarWidth) 전체를 단일 `try/catch`로 감쌉니다. 주석에는 "해당 항목 건너뜀"이라고 기술되어 있으나, 실제 동작은 첫 번째 항목 검증 실패 시 남은 모든 항목이 처리되지 않습니다.

**예시**: `colorPrimary`가 잘못된 형식이면 `colorSecondary`, `fontFamily` 등 유효한 값도 함께 폐기됩니다.

**권장 수정**:
```typescript
function safeOverride(
  overrides: string[],
  generator: () => string | string[],
  tenantId: string,
  fieldName: string,
): void {
  try {
    const result = generator()
    if (Array.isArray(result)) overrides.push(...result)
    else overrides.push(result)
  } catch (error) {
    console.error(`[TenantCSS] ${fieldName} 검증 오류 (tenantId: ${tenantId}):`, error)
  }
}
```
각 항목을 `safeOverride` 헬퍼로 감싸면 항목별 독립 에러 처리가 가능합니다.

---

### HIGH-04 — 미해결

**위치**: `MTU-U1-impl-S3-tenant-ai.md`, `hooks/use-ai-chat.ts` 스니펫, 약 1468–1483행

**코드**:
```typescript
const sendMessage = useCallback(
  (text: string) => {
    // ...
    chat.sendMessage({ text: maskedText })
  },
  [validation, chat, onError]   // chat 전체 객체 의존
)
```

**문제**: `useChat()` 훅이 반환하는 `chat` 객체는 렌더링마다 새 참조를 생성할 수 있습니다. `chat` 전체를 의존성 배열에 넣으면 `chat`가 바뀔 때마다 `sendMessage`가 재생성되어 불필요한 리렌더링이 발생합니다. AI SDK 5의 `useChat`는 `sendMessage`를 안정적인 함수 참조로 제공하므로 구조 분해 후 해당 함수만 의존성으로 지정해야 합니다.

**권장 수정**:
```typescript
const { sendMessage: chatSendMessage, messages, status } = useChat(...)

const sendMessage = useCallback(
  (text: string) => {
    // ...
    chatSendMessage({ text: maskedText })
  },
  [validation, chatSendMessage, onError]
)
```

---

### HIGH-06 — 미해결

**위치**: `MTU-U1-impl-S3-tenant-ai.md`, `app/api/ai/chat/route.ts` 스니펫, 약 1590행

**코드**:
```typescript
messages: convertToModelMessages(sanitizedMessages as UIMessage[]),
```

**문제**: `sanitizedMessages`는 `messages.map(...)` 으로 생성된 새 배열로, 원본 `UIMessage[]` 타입과 구조적으로 다를 수 있습니다(특히 `parts`의 `text` 필드가 선택적으로 처리됨). `as UIMessage[]` 캐스팅은 타입 불일치를 숨깁니다.

**권장 수정**: `convertToModelMessages`가 수용하는 실제 파라미터 타입을 확인하여 캐스팅 없이 타입이 맞도록 `sanitizedMessages`의 타입을 명시하거나, Zod 스키마로 파싱 후 타입을 좁혀야 합니다. 최소한 주석으로 캐스팅 사유를 명시해야 합니다:
```typescript
// AI SDK 5 convertToModelMessages는 UIMessage[]를 요구하며,
// sanitizedMessages는 원본 UIMessage에서 parts.text만 마스킹한 구조적 하위 타입임.
// TODO: sanitizedMessages 타입을 UIMessage와 정확히 일치시키는 매핑 함수로 교체 필요.
messages: convertToModelMessages(sanitizedMessages as UIMessage[]),
```

---

## 해결된 이슈 확인

### HIGH-02 — 해결 확인

`addWidget`, `removeWidget`, `reorderWidgets`, `resizeWidget` 4개 동작 모두 `.catch((err: unknown) => { ... set saveError ... })` 패턴을 적용했습니다. `saveError` 상태도 `DashboardState` 인터페이스에 선언되어 UI에서 사용자에게 알릴 수 있습니다. **완전히 해결**.

### HIGH-05 — 해결 확인

`loadLayout`에서 API 응답에 대해 `layoutResponseSchema.safeParse(data)`를 수행하고, `parsed.success`가 `false`일 때 `parsed.error.issues`를 로깅한 뒤 기존 레이아웃을 유지합니다. **완전히 해결**.

---

## 잔여 MED/LOW 이슈

| 이슈 ID | 내용 | 상태 | 비고 |
|---------|------|------|------|
| MED-01 | 빈 `handleDragOver` useCallback 제거 | ✅ | 함수 제거 + 주석으로 설명 대체 |
| MED-02 | `React.lazy` 컴포넌트에 `<Suspense>` 경계 누락 | ❌ | 미수정 유지 — `WidgetCard` 내 `WidgetComponent` 직접 렌더링 |

### MED-02 상세

`widget-card.tsx` 스니펫에서 `WidgetComponent`는 `widgetRegistry`에서 `lazy()`로 생성된 컴포넌트입니다. `<Suspense>` 경계 없이 직접 `<WidgetComponent props={...} />` 를 렌더링하면 청크 로딩 중 React 서스펜스 경계가 없어 상위 트리에서 예기치 않은 폴백이 발생합니다.

```typescript
// 현재 코드 (문제 있음)
{WidgetComponent ? (
  <WidgetComponent props={widget.props} />
) : (
  <p role="status">위젯을 불러오는 중...</p>
)}
```

`WidgetComponent ? ... : ...` 조건은 레지스트리 등록 여부를 확인할 뿐 lazy 청크 로딩 상태와 무관합니다. 권장 패턴:

```typescript
import { Suspense } from 'react'

{WidgetComponent ? (
  <Suspense fallback={<p role="status" className="...">위젯을 불러오는 중...</p>}>
    <WidgetComponent props={widget.props} />
  </Suspense>
) : (
  <p role="status" className="...">알 수 없는 위젯 유형</p>
)}
```

---

## 신규 발견 이슈

### NEW-01 — MEDIUM: `saveLayout` 내 async 콜백 디바운스 타이머 누수

**위치**: `stores/dashboard-store.ts` 스니펫, `saveLayout` 함수

```typescript
saveDebounceTimer = setTimeout(async () => {
  // ...await fetch(...)...
}, SAVE_DEBOUNCE_MS)
```

`setTimeout`에 `async` 콜백을 전달하면 내부 `await` 이후 발생하는 예외가 별도의 미처리 Promise 거부로 전파됩니다. 현재 `try/catch`로 에러를 잡고 있지만, 디바운스 타이머 자체는 컴포넌트 언마운트나 스토어 소멸 시 정리되지 않습니다. Zustand 스토어는 싱글톤이므로 실용적 위험은 낮지만, 페이지 이탈 직후 완료되는 저장 요청이 이미 소멸된 `set` 컨텍스트를 참조할 수 있습니다.

**권장**: 스토어 소멸 시 `clearTimeout(saveDebounceTimer)` 호출을 보장하거나, `saveDebounceTimer`를 스토어 상태 내에서 관리하여 라이프사이클을 명시하십시오.

### NEW-02 — LOW: `localStorage` 직접 접근 SSR 안전 처리 비일관성

**위치**: `stores/dashboard-store.ts` 스니펫, `saveLayout`/`loadLayout` 함수

```typescript
const token = typeof window !== 'undefined'
  ? localStorage.getItem('access_token')
  : null
```

`typeof window !== 'undefined'` 가드는 적용되었지만, Zustand `persist`의 `storage: createJSONStorage(() => localStorage)` 는 SSR 환경에서 초기화 시 오류를 발생시킬 수 있습니다. `createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : { ... }))` 형태의 안전한 래퍼를 사용하거나 Next.js App Router의 클라이언트 컴포넌트 경계에서만 스토어를 초기화하도록 명시해야 합니다.

---

## 최종 판정

**CONDITIONAL PASS**

- HIGH-02, HIGH-05 해결 확인
- MED-01 해결 확인
- **HIGH-01, HIGH-03, HIGH-04, HIGH-06 미해결** — 4건이 잔존하므로 Q-GATE G3 통과 조건 미충족
- 신규 발견: NEW-01(MEDIUM), NEW-02(LOW) 2건 추가

Q-GATE G3 통과를 위해서는 HIGH-01(이중 단언 → `JSON.parse/stringify` 교체), HIGH-03(항목별 독립 에러 처리), HIGH-04(`chat` → `chatSendMessage` 구조 분해), HIGH-06(캐스팅 사유 주석 또는 타입 개선) 4건을 수정 후 재검토를 받아야 합니다.

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — MTU-U1 TypeScript 재검토 | Reviewer Agent |
