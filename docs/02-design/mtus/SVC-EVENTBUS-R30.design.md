# SVC-EVENTBUS-R30 DESIGN: Event Bus 라이브러리

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/SVC-EVENTBUS-R30.plan.md

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 초안 작성 | PM Lead |

---

## 이벤트 흐름

```
발행자 → EventBus.emit('user.created', payload)
  → 매칭 핸들러 조회 (정확 매치 + 와일드카드)
  → 각 핸들러 비동기 실행 (Promise.allSettled)
  → 에러 핸들러 격리 (한 핸들러 실패 → 다른 핸들러 영향 없음)
  → 메트릭 업데이트
```

---

## 와일드카드 패턴

```
user.created   → 매치: 'user.created', 'user.*', '*'
order.payment  → 매치: 'order.payment', 'order.*', '*'
*              → 모든 이벤트 매치
```

규칙: `*`는 단일 세그먼트 매치. `pattern.*`는 해당 접두사의 모든 하위 이벤트 매치.

---

## 주요 인터페이스

```typescript
interface EventPayload {
  eventName: string;
  timestamp: string;
  data: unknown;
}

type EventHandler = (payload: EventPayload) => Promise<void> | void;

interface EventBusMetrics {
  totalEmitted: number;
  totalHandled: number;
  totalErrors: number;
  handlerCount: number;
}

interface EventBus {
  emit(eventName: string, data: unknown): Promise<void>;
  on(pattern: string, handler: EventHandler): () => void;  // 구독 해제 함수 반환
  once(pattern: string, handler: EventHandler): () => void;
  off(pattern: string, handler: EventHandler): void;
  getMetrics(): EventBusMetrics;
  removeAllListeners(): void;
}
```

---

## Session Guide

### 구현 순서
1. `src/event-bus.ts` -- 코어 Event Bus
2. `src/index.ts` -- 패키지 엔트리포인트
3. `tests/event-bus.test.ts` -- 단위 테스트

### Design Anchor
- 모든 구현 파일 상단: `// Design Ref: SVC-EVENTBUS-R30 DESIGN`
- 모든 함수: `// Plan SC: FR-EB.{번호}`
