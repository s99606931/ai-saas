# SVC-AI-ADV-R422 Design — Smart Parking Allocator AI

Plan Ref: SVC-AI-ADV-R422.plan.md

## 인터페이스
```ts
export type PriorityClass = 'EMERGENCY' | 'DISABLED' | 'STAFF' | 'VISITOR';
export interface ParkingRequest {
  readonly requestId: string;
  readonly priority: PriorityClass;
}
export interface Slot {
  readonly slotId: string;
  readonly distanceFromEntrance: number;
  readonly occupied: boolean;
}
export interface Allocation {
  readonly requestId: string;
  readonly assigned: string | null;
  readonly reason: string;
  readonly alert?: 'SATURATED';
}
```

## 알고리즘
1. N2SF 차단
2. 우선순위 스코어 맵 {EMERGENCY:100, DISABLED:90, STAFF:60, VISITOR:30}
3. 가용(free) 슬롯 없으면 NO_SLOT
4. nearest-fit: 거리 오름차순 첫 번째 free
5. 점유 표시 + 활용률 계산
6. 활용률 > 0.9 → alert='SATURATED'
