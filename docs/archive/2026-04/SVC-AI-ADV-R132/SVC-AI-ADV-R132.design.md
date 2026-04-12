# SVC-AI-ADV-R132 — AI Audit Replay Engine (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0 | 설계자: PM Lead

## 아키텍처 선택: Pragmatic Balance

읽기 전용 재현기 — 원본 events 배열은 불변(push-only). filter 결과는 shallow copy. taraceId 체인 추출 + bucket 그룹화.

## 핵심 타입

```typescript
export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export interface AuditEvent {
  id: string
  timestamp: number
  actor: string
  action: string
  resource: string
  traceId?: string
  payload?: Record<string, unknown>
}

export interface ReplayFilter {
  from?: number
  to?: number
  actor?: string
  action?: string
  resource?: string
  traceId?: string
}

export interface TimelineBucket {
  start: number
  end: number
  count: number
  events: AuditEvent[]
}

export interface CausalityChain {
  traceId: string
  length: number
  events: AuditEvent[]
  durationMs: number
}

export interface VisualizationExport {
  filter: ReplayFilter
  generatedAt: number
  buckets: TimelineBucket[]
  chains: CausalityChain[]
}

export interface ReplayAuditEntry {
  action: 'ingested' | 'replayed' | 'timelineBuilt' | 'causalityTraced' | 'exported'
  timestamp: number
  details: Record<string, unknown>
}
```

## API

```typescript
class AIAuditReplayEngine {
  constructor(grade: DataGrade)
  ingest(event: AuditEvent): void
  replay(filter: ReplayFilter): AuditEvent[]
  buildTimeline(events: AuditEvent[], bucketMs: number): TimelineBucket[]
  traceCausality(traceId: string): CausalityChain
  maskSensitive(event: AuditEvent): AuditEvent
  exportVisualization(filter: ReplayFilter, bucketMs: number): VisualizationExport
  getAuditLog(): ReplayAuditEntry[]
}
```

## 알고리즘

### ingest
- 중복 id throw
- push to events
- 정렬 유지를 위해 binary insert (timestamp 기준), 동률은 삽입 순서 유지

### replay (filter 적용)
- events slice 순회, from/to 범위 + actor/action/resource/traceId 부분 매칭
- 각 이벤트에 대해 maskSensitive 적용한 shallow copy 반환 (원본 불변)

### buildTimeline
- bucketMs <= 0 throw
- 첫 이벤트 timestamp를 bucket 경계 시작으로 floor
- 이벤트 순회 → `bucketIdx = floor((t - origin) / bucketMs)`
- bucket[idx] events 배열에 push

### traceCausality
- `filter({traceId})`로 조회 + 시간 정렬
- durationMs = last.timestamp - first.timestamp
- 존재하지 않으면 빈 체인 반환

### maskSensitive
- payload 재귀 순회, 문자열 필드에서 이메일/주민번호/전화번호 정규식 치환
- 원본 이벤트는 복사 (spread + 새 payload 객체)

### exportVisualization
- replay → buildTimeline → 고유 traceId 집합 추출 → 각 traceCausality 호출
- 반환 객체는 deep copy (JSON.parse(JSON.stringify))

## 보안 가드

- 생성자 `grade !== O` throw
- ingest 시 id/actor/action/resource 비어있으면 throw
- maskSensitive에서 `process.env` 같은 시크릿 키 노출 패턴은 `[REDACTED]` 치환

## 테스트 계획 (12개+)

1. FR-R132.1 ingest + 중복 id throw
2. FR-R132.2 from/to 범위 필터
3. actor/action/resource 필터
4. traceId 필터
5. FR-R132.3 buildTimeline bucket 그룹화
6. bucket 경계 계산 검증
7. FR-R132.4 traceCausality 체인 + duration
8. 존재하지 않는 traceId → 빈 체인
9. FR-R132.5 maskSensitive 이메일/주민번호/전화
10. FR-R132.6 exportVisualization 통합
11. 원본 불변성 (replay 후 event 수정 금지)
12. C 등급 차단
13. bucketMs <= 0 throw
14. getAuditLog append-only

## Design Anchor

- **구현 Ref**: `platform/services/ai-service/src/lib/ai-audit-replay-engine.ts`
- **테스트 Ref**: `platform/services/ai-service/src/lib/__tests__/ai-audit-replay-engine.test.ts`
- **기존 모듈 구분**: `ai-telemetry-replayer.ts`가 있을 경우 — 해당 모듈은 텔레메트리(수치 메트릭) 재현, 본 모듈은 감사 이벤트(actor/action) 재현.
