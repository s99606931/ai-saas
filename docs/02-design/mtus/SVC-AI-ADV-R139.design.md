# MTU Design — SVC-AI-ADV-R139 Adaptive UI Generator

## 핵심 타입

```typescript
type EventType = 'click' | 'dwell' | 'scroll'
interface BehaviorEvent { componentId: string; type: EventType; value: number; ts: number }
interface ComponentSpec { id: string; required?: boolean; defaultOrder: number }
interface UiLayoutSpec { components: { id: string; visible: boolean; order: number; score: number }[] }
```

## 메서드

- `ingest(events[], grade)` — 이벤트 집계
- `generate(components, grade)` — UI 스펙 생성
- `computeScore(componentId)` — click=3, dwell=0.1/sec, scroll=0.5
- `getAuditLog()`

## 접근성 보장

- `required: true` 컴포넌트는 항상 visible=true

## Session Guide

- 파일: `adaptive-ui-generator.ts`
- 테스트: `__tests__/adaptive-ui-generator.test.ts`
