# SVC-AI-ADV-R109 — Cache Prewarming Scheduler Design

## 인터페이스

```typescript
export interface AccessEvent {
  resourceId: string;
  timestamp: number; // epoch ms
}

export interface PrewarmEntry {
  triggerIso: string;
  hour: number;
  resources: string[];
}

export class CachePrewarmingScheduler {
  plan(events: AccessEvent[], opts: { topN: number; leadMinutes: number; baseDay: Date }): PrewarmEntry[];
}
```

## 알고리즘

1. 이벤트를 (dayOfWeek, hour) 버킷으로 그룹
2. 각 버킷에서 resourceId count top-N 선택
3. 프리워밍 시각 = 버킷 시작 - leadMinutes
4. 중복 리소스 dedup

## 테스트

1. 핫 리소스 top-N
2. 빈 이벤트 → []
3. leadMinutes 정확 반영
4. 여러 시간대 그룹핑
5. dedup 검증
