# SVC-AI-ADV-R108 — Maintenance Window Optimizer Design

## 인터페이스

```typescript
export interface HourlyTraffic {
  dayOfWeek: 0|1|2|3|4|5|6; // 0=Sun
  hour: number;  // 0-23
  rps: number;
}

export interface MaintenanceRequest {
  durationHours: number;
  deadlineIso: string;
  preferWeekend?: boolean;
}

export interface ScheduleProposal {
  startIso: string;
  endIso: string;
  expectedAffectedUsers: number;
  score: number;
  reasoning: string;
}

export class MaintenanceWindowOptimizer {
  propose(traffic: HourlyTraffic[], req: MaintenanceRequest, now: Date): ScheduleProposal;
}
```

## 알고리즘

1. 현재 ~ deadline 사이 모든 시간대 순회
2. 각 시작점에 대해 durationHours 슬롯의 합계 트래픽 계산
3. 주말 시간대 가산 (10% 할인)
4. 최저 합 선택

## 테스트

1. 최저 시간대 선택
2. 주말 선호
3. 데드라인 내 배치
4. 데드라인 초과 예외
5. 점수 랭킹
