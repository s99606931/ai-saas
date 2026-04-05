# MTU-U1 TypeScript 검토 보고서

| 항목 | 결과 |
|------|------|
| 검토일 | 2026-04-05 |
| 검토 파일 | 3개 |
| 발견 이슈 | 14개 (HIGH: 6, MED: 5, LOW: 3) |
| 전체 판정 | CONDITIONAL PASS |

검토 대상:
- `MTU-U1-impl-S1S2-tokens-layout.md` (Session 1+2 — 디자인 토큰 + 레이아웃)
- `MTU-U1-impl-S3-tenant-ai.md` (Session 3 — 테넌트 커스터마이제이션 + AI UI)
- `MTU-U1-impl-S4-dnd-a11y-storybook.md` (Session 4 — 동적 레이아웃 + 접근성 + Storybook)

---

## 이슈 목록

### HIGH 이슈 (즉시 수정 필요)

---

#### HIGH-01: `as unknown as Record<string, unknown>` 이중 단언 — 타입 안전성 파괴

**파일**: `MTU-U1-impl-S3-tenant-ai.md` > 1.4 테넌트 테마 API (`app/api/tenant/theme/route.ts`)

**문제**: `existing as unknown as Record<string, unknown>` 는 TypeScript 타입 시스템을 완전히 우회하는 이중 단언이다. Prisma가 반환하는 `TenantTheme` 객체를 `Json` 타입 필드(`themeSnapshot`)에 넣기 위해 사용하였으나, Prisma의 `InputJsonValue` 타입에 올바르게 대응하지 않았다.

수정 전:
```typescript
themeSnapshot: existing as unknown as Record<string, unknown>,
```

수정 후:
```typescript
// Prisma InputJsonValue 호환 방식 — 직렬화 후 역직렬화
themeSnapshot: JSON.parse(JSON.stringify(existing)) as Prisma.InputJsonValue,
```

---

#### HIGH-02: `saveLayout`이 `async`이지만 반환 Promise를 무시 — Floating Promise

**파일**: `MTU-U1-impl-S4-dnd-a11y-storybook.md` > 1.1.5 대시보드 상태 관리 (`stores/dashboard-store.ts`)

**문제**: `addWidget`, `removeWidget`, `reorderWidgets`, `resizeWidget` 에서 `get().saveLayout()` 을 호출하는데, `saveLayout`은 `async` 함수다. 반환된 Promise가 `await` 없이 버려지므로 저장 실패가 조용히 무시된다. Zustand `immer` 콜백 내부에서는 `await`를 사용할 수 없으므로 구조 자체를 재검토해야 한다.

수정 전:
```typescript
addWidget: (type: WidgetType) => {
  // ...
  set((state) => { state.widgets.push(newWidget) })
  get().saveLayout()  // Promise 버려짐
},
```

수정 후:
```typescript
addWidget: (type: WidgetType) => {
  // ...
  set((state) => { state.widgets.push(newWidget) })
  void get().saveLayout()  // 의도적 fire-and-forget 명시, 또는
  // 아래처럼 에러를 상태로 캡처하는 방식이 더 안전함:
  get().saveLayout().catch((err) => {
    set((state) => { state.saveError = String(err) })
  })
},
```

---

#### HIGH-03: `generateTenantCSS`에서 첫 번째 에러 발생 시 이후 검증 건너뜀 — 부분 적용 버그

**파일**: `MTU-U1-impl-S3-tenant-ai.md` > 1.3.1 CSS 생성 유틸리티 (`lib/theme/css-generator.ts`)

**문제**: `try/catch` 블록이 모든 색상·크기 검증을 하나로 묶고 있다. `colorPrimary` 검증에서 예외가 발생하면 `colorSecondary`, `fontFamily` 등 나머지 속성도 모두 건너뛴다. 결과적으로 `colorPrimary` 하나의 오류가 전체 테마 CSS를 무력화한다. 항목별 독립 에러 처리가 필요하다.

수정 전:
```typescript
try {
  if (config.colorPrimary) { ... }
  if (config.colorSecondary) { ... }
  // ...모든 항목
} catch (error) {
  console.error(...)
}
```

수정 후: 각 항목을 독립된 `try/catch`로 분리하거나, 헬퍼 함수로 감싸 개별 실패를 격리한다.
```typescript
const safeOverride = (key: string, value: string, sanitizeFn: (v: string) => string) => {
  try {
    overrides.push(`  ${key}: ${sanitizeFn(value)};`)
  } catch (error) {
    console.error(`[TenantCSS] ${key} 검증 오류 (tenantId: ${config.tenantId}):`, error)
  }
}
```

---

#### HIGH-04: `useAIChat`에서 `chat` 객체를 `useCallback` 의존성 배열에 포함 — 무한 리렌더링 위험

**파일**: `MTU-U1-impl-S3-tenant-ai.md` > 2.3 AI 채팅 훅 (`hooks/use-ai-chat.ts`)

**문제**: `useCallback` 의존성 배열에 `chat` 전체 객체가 포함되어 있다. `useChat`이 매 렌더마다 새 객체 참조를 반환하면 `sendMessage` 콜백도 매번 재생성되고, 이를 의존하는 컴포넌트가 불필요하게 리렌더된다. AI SDK 5의 `useChat`이 안정된 함수 참조를 보장하는지 문서상 명확하지 않으므로, `chat.sendMessage`만 구조 분해하여 의존성을 좁혀야 한다.

수정 전:
```typescript
const chat = useChat({ ... })

const sendMessage = useCallback(
  (text: string) => {
    // ...
    chat.sendMessage({ text: maskedText })
  },
  [validation, chat, onError]  // chat 전체 객체
)
```

수정 후:
```typescript
const { messages, status, sendMessage: chatSendMessage } = useChat({ ... })

const sendMessage = useCallback(
  (text: string) => {
    if (!validation.allowed) { onError?.(new Error(validation.reason)); return }
    chatSendMessage({ text: maskPII(text) })
  },
  [validation, chatSendMessage, onError]
)
```

---

#### HIGH-05: `loadLayout`에서 API 응답 데이터에 런타임 타입 검증 없이 상태 반영

**파일**: `MTU-U1-impl-S4-dnd-a11y-storybook.md` > 1.1.5 대시보드 상태 관리 (`stores/dashboard-store.ts`)

**문제**: `data.widgets`를 `Array.isArray` 확인만 하고 곧바로 상태에 쓰고 있다. 각 위젯 객체가 `WidgetConfig` 구조를 준수하는지 검증하지 않으면, 서버에서 잘못된 데이터가 오거나 `localStorage`가 조작되었을 때 앱이 런타임에 깨질 수 있다.

수정 전:
```typescript
const data = await response.json()
if (data.widgets && Array.isArray(data.widgets)) {
  set((state) => { state.widgets = data.widgets })
}
```

수정 후: Zod 스키마로 검증한다.
```typescript
import { z } from 'zod'

const widgetConfigSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  size: z.object({ w: z.number(), h: z.number() }),
  props: z.record(z.unknown()),
})

const layoutResponseSchema = z.object({
  widgets: z.array(widgetConfigSchema),
})

const parsed = layoutResponseSchema.safeParse(data)
if (parsed.success) {
  set((state) => { state.widgets = parsed.data.widgets as WidgetConfig[] })
}
```

---

#### HIGH-06: AI 채팅 Route Handler에서 `sanitizedMessages`를 `UIMessage[]`로 강제 단언

**파일**: `MTU-U1-impl-S3-tenant-ai.md` > 2.4 AI 채팅 서버 API (`app/api/ai/chat/route.ts`)

**문제**: `convertToModelMessages(sanitizedMessages as UIMessage[])` 에서 `as UIMessage[]` 단언을 사용하고 있다. `sanitizedMessages`는 Zod 스키마 검증을 통과한 배열이지만, 그 타입은 Zod 추론 타입이며 AI SDK 5의 `UIMessage` 타입과 완전히 일치하지 않을 수 있다. 잘못된 런타임 구조가 AI SDK 내부에서 예기치 않은 오류를 유발할 수 있다.

수정 전:
```typescript
messages: convertToModelMessages(sanitizedMessages as UIMessage[]),
```

수정 후: Zod 스키마를 `UIMessage` 타입에 맞게 정밀 정렬하거나, 명시적 변환 함수를 작성한다.
```typescript
// chatRequestSchema의 messages 타입을 UIMessage와 정렬:
// z.object({ id, role, parts: z.array(...) }) 구조가 UIMessage와 일치하는지 확인 후,
// 단언 대신 타입 가드를 사용한다.
function toUIMessages(msgs: typeof parsed.data.messages): UIMessage[] {
  // 구조적 호환성을 명시적으로 보장
  return msgs as UIMessage[]  // 스키마 정렬이 확인된 경우에만 사용
}
```

---

### MED 이슈 (다음 버전 수정)

---

#### MED-01: `handleDragOver` 콜백이 빈 함수 — 의미 없는 `useCallback` 비용

**파일**: `MTU-U1-impl-S4-dnd-a11y-storybook.md` > 1.1.1 대시보드 컨텍스트 프로바이더 (`components/dashboard/dashboard-provider.tsx`)

**문제**: `handleDragOver`가 빈 함수체로 정의되어 있고 `useCallback`으로 메모이제이션된다. 빈 함수를 메모이제이션하는 것은 불필요한 코드다. `onDragOver`에 빈 핸들러가 필요하지 않다면 prop 자체를 제거해야 한다.

수정 전:
```typescript
const handleDragOver = useCallback(({ active, over }: DragOverEvent) => {
  // 드래그 오버 시 시각 피드백은 DragOverlay가 처리
}, [])
```

수정 후: `onDragOver` prop을 `DndContext`에서 제거하거나, 실제 로직이 생길 때 추가한다.

---

#### MED-02: `WidgetCard`에서 `WidgetComponent` 렌더링 시 Suspense 경계 없음

**파일**: `MTU-U1-impl-S4-dnd-a11y-storybook.md` > 1.1.3 개별 위젯 카드 (`components/dashboard/widget-card.tsx`)

**문제**: `widgetRegistry`의 위젯 컴포넌트들이 `React.lazy()`로 정의되어 있다. `WidgetCard` 내부에서 `<WidgetComponent>` 를 직접 렌더링할 때 `<Suspense>` 경계가 없으면 React가 경고를 발생시키고, lazy 컴포넌트 로딩 중 렌더 트리 전체가 중단될 수 있다.

수정 전:
```typescript
{WidgetComponent ? (
  <WidgetComponent props={widget.props} />
) : (
  <p ...>위젯을 불러오는 중...</p>
)}
```

수정 후:
```typescript
import { Suspense } from 'react'

{WidgetComponent ? (
  <Suspense fallback={<p className="text-sm ..." role="status">위젯을 불러오는 중...</p>}>
    <WidgetComponent props={widget.props} />
  </Suspense>
) : null}
```

---

#### MED-03: `hexToRelativeLuminance`에서 6자리 미만 hex 입력 시 `parseInt` NaN 반환

**파일**: `MTU-U1-impl-S3-tenant-ai.md` > 1.3.2 WCAG 대비율 검증 (`lib/theme/contrast-checker.ts`)

**문제**: `hex.replace('#', '')` 후 `substring(0, 2)` 방식으로 파싱하는데, 3자리 hex(`#RGB`)가 입력되면 채널 값이 잘못 계산된다. 3자리 hex는 공개 색상 형식이므로 지원하거나, 입력을 명시적으로 제한해야 한다.

수정 전:
```typescript
export function hexToRelativeLuminance(hex: string): number {
  const cleaned = hex.replace('#', '')
  const r = parseInt(cleaned.substring(0, 2), 16)
  const g = parseInt(cleaned.substring(2, 4), 16)
  const b = parseInt(cleaned.substring(4, 6), 16)
  // ...
}
```

수정 후: 입력 검증 또는 3자리 hex 확장을 추가한다.
```typescript
export function hexToRelativeLuminance(hex: string): number {
  let cleaned = hex.replace('#', '')
  if (cleaned.length === 3) {
    cleaned = cleaned.split('').map((c) => c + c).join('')
  }
  if (cleaned.length !== 6) {
    throw new Error(`유효하지 않은 hex 색상: ${hex}`)
  }
  // ...
}
```

---

#### MED-04: `useArrowKeyNav`의 `containerRef` 타입이 `RefObject<HTMLElement>` — 제네릭 없음

**파일**: `MTU-U1-impl-S4-dnd-a11y-storybook.md` > 2.3.4 키보드 접근성 (`components/ui/keyboard-nav.tsx`)

**문제**: `containerRef`가 `RefObject<HTMLElement>` 로 고정되어 있어, 호출하는 컴포넌트에서 `<ul ref={containerRef}>` 같이 더 구체적인 요소 타입을 사용하면 타입 오류가 발생한다. 제네릭을 사용하면 더 유연하고 타입 안전해진다.

수정 전:
```typescript
const containerRef = useRef<HTMLElement>(null)
// ...
return { containerRef, handleKeyDown }
```

수정 후:
```typescript
export function useArrowKeyNav<T extends HTMLElement = HTMLElement>(
  options: { orientation?: ...; loop?: boolean } = {}
) {
  const containerRef = useRef<T>(null)
  // ...
  return { containerRef, handleKeyDown }
}
```

---

#### MED-05: `FormField`에서 `React.cloneElement`에 `Record<string, unknown>` 단언 사용

**파일**: `MTU-U1-impl-S4-dnd-a11y-storybook.md` > 2.3.6 오류 식별 (`components/ui/form-error.tsx`)

**문제**: `React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {...})` 패턴은 자식 요소의 props 타입을 강제로 `Record<string, unknown>`으로 넓혀서 타입 안전성을 버린다. 실제 주입하는 prop(`id`, `aria-required` 등)만 포함하는 인터페이스를 사용해야 한다.

수정 전:
```typescript
return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
  id,
  'aria-required': required,
  'aria-describedby': ...,
  'aria-invalid': ...,
})
```

수정 후:
```typescript
interface InjectableProps {
  id?: string
  'aria-required'?: boolean
  'aria-describedby'?: string
  'aria-invalid'?: true
}

return React.cloneElement(child as React.ReactElement<InjectableProps>, {
  id,
  'aria-required': required,
  'aria-describedby': ...,
  'aria-invalid': errorMessage ? true : undefined,
})
```

---

### LOW 이슈 (개선 권장)

---

#### LOW-01: `AI_PROVIDER`를 `as AIProviderType`으로 단언 — 환경변수 검증 없음

**파일**: `MTU-U1-impl-S3-tenant-ai.md` > 2.2 AI 공급자 설정 (`lib/ai/provider.ts`)

**문제**: `(process.env.AI_PROVIDER ?? 'LOCAL') as AIProviderType` 은 환경변수에 임의 문자열이 들어와도 타입 오류 없이 통과한다. 런타임에 잘못된 값이 들어오면 `getAIModel`의 분기 로직이 의도와 다르게 동작한다.

수정 전:
```typescript
const AI_PROVIDER = (process.env.AI_PROVIDER ?? 'LOCAL') as AIProviderType
```

수정 후:
```typescript
const rawProvider = process.env.AI_PROVIDER ?? 'LOCAL'
if (rawProvider !== 'LOCAL' && rawProvider !== 'EXTERNAL') {
  throw new Error(`유효하지 않은 AI_PROVIDER 값: ${rawProvider}. 허용값: LOCAL | EXTERNAL`)
}
const AI_PROVIDER: AIProviderType = rawProvider
```

---

#### LOW-02: `resolveTenantByDomain`에서 `res.json()` 반환 타입이 `any`

**파일**: `MTU-U1-impl-S3-tenant-ai.md` > 1.5 Edge Middleware (`middleware.ts`)

**문제**: `return res.json()` 의 반환 타입이 `Promise<any>`로 추론된다. 호출부에서 `{ id: string; themeId: string } | null`을 기대하지만, 서버 응답 구조가 틀려도 컴파일 시점에 잡히지 않는다.

수정 전:
```typescript
return res.json()
```

수정 후:
```typescript
const data: unknown = await res.json()
// 최소한 간단한 가드라도 추가
if (
  typeof data === 'object' && data !== null &&
  'id' in data && typeof (data as Record<string, unknown>).id === 'string' &&
  'themeId' in data && typeof (data as Record<string, unknown>).themeId === 'string'
) {
  return data as { id: string; themeId: string }
}
return null
```

---

#### LOW-03: `CsapProgressWidget`에서 `stats`가 하드코딩된 목 데이터 — 타입 없음

**파일**: `MTU-U1-impl-S4-dnd-a11y-storybook.md` > 1.1.4 위젯 구현 예시 (`csap-progress-widget.tsx`)

**문제**: `const stats = { total: 79, passed: 65, ... }` 이 인라인 객체 리터럴이고 타입 정의가 없다. 가이드 문서이므로 목 데이터 자체가 문제는 아니지만, API 연동 시 이 구조체를 그대로 쓰면 실수가 발생할 수 있다. 인터페이스 정의와 주석으로 의도를 명확히 해야 한다.

수정 전:
```typescript
const stats = {
  total: 79,
  passed: 65,
  inProgress: 10,
  pending: 4,
  grade: props.targetGrade === 'high' ? '상' : '중',
}
```

수정 후:
```typescript
interface CsapStats {
  total: number
  passed: number
  inProgress: number
  pending: number
  grade: '상' | '중'
}

// TODO: Phase 2에서 useSWR/useQuery로 실제 API 데이터 연동 예정 (FR-U.12)
const stats: CsapStats = {
  total: 79,
  passed: 65,
  inProgress: 10,
  pending: 4,
  grade: props.targetGrade === 'high' ? '상' : '중',
}
```

---

## 수정 권고사항 요약

### 즉시 수정 필요 (HIGH)

| 번호 | 파일 | 내용 |
|------|------|------|
| HIGH-01 | `app/api/tenant/theme/route.ts` | `as unknown as Record<string, unknown>` 이중 단언 → Prisma InputJsonValue 호환 직렬화로 교체 |
| HIGH-02 | `stores/dashboard-store.ts` | `saveLayout()` floating promise → `void` 또는 `.catch()` 명시 처리 |
| HIGH-03 | `lib/theme/css-generator.ts` | 단일 try/catch로 전체 속성 묶기 → 항목별 독립 에러 격리 |
| HIGH-04 | `hooks/use-ai-chat.ts` | `useCallback` 의존성에 `chat` 객체 전체 포함 → `chatSendMessage` 함수만 구조 분해 |
| HIGH-05 | `stores/dashboard-store.ts` | API 응답 무검증 상태 반영 → Zod 스키마 런타임 검증 추가 |
| HIGH-06 | `app/api/ai/chat/route.ts` | `sanitizedMessages as UIMessage[]` 단언 → 스키마-타입 정렬 후 단언 범위 최소화 |

### 다음 버전 수정 (MED)

| 번호 | 파일 | 내용 |
|------|------|------|
| MED-01 | `dashboard-provider.tsx` | 빈 `handleDragOver` + 불필요한 `useCallback` 제거 |
| MED-02 | `widget-card.tsx` | `React.lazy` 컴포넌트 렌더링에 `<Suspense>` 경계 추가 |
| MED-03 | `lib/theme/contrast-checker.ts` | 3자리 hex 입력 처리 또는 명시적 입력 검증 |
| MED-04 | `components/ui/keyboard-nav.tsx` | `useArrowKeyNav` 제네릭 타입 파라미터 추가 |
| MED-05 | `components/ui/form-error.tsx` | `React.cloneElement` 단언을 구체적 props 인터페이스로 교체 |

### 개선 권장 (LOW)

| 번호 | 파일 | 내용 |
|------|------|------|
| LOW-01 | `lib/ai/provider.ts` | `AI_PROVIDER` 환경변수 런타임 허용값 검증 추가 |
| LOW-02 | `middleware.ts` | `res.json()` 반환값 타입 가드 추가 |
| LOW-03 | `csap-progress-widget.tsx` | 목 데이터 구조체에 인터페이스 + TODO 주석 추가 |

---

## 총평

전반적인 TypeScript 품질은 양호하다. `strict: true` 설정, Zod 검증 패턴, RBAC 미들웨어, Prisma 활용이 일관되게 적용되어 있다. React 컴포넌트의 props 인터페이스 정의와 접근성 ARIA 패턴도 수준이 높다.

HIGH 이슈 6개 중 가장 위험한 것은 HIGH-02(Floating Promise)와 HIGH-03(CSS 생성 단일 try/catch)이다. HIGH-02는 레이아웃 저장 실패가 조용히 무시되어 데이터 유실로 이어질 수 있다. HIGH-03은 테넌트 CSS 전체가 무력화되어 흰 화면이 발생하거나 기본 테마로 폴백될 수 있다.

HIGH 이슈 6개를 수정하면 PASS 판정 가능하다.
