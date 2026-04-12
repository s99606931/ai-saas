# SVC-AI-ADV-R70 — 설계

## 모듈
- `cost-aware-batch-scheduler.ts`
  - `CostAwareBatchScheduler` 클래스

## 핵심 타입
```typescript
type DataGrade = 'C' | 'S' | 'O';

interface BatchJob {
  id: string;
  name: string;
  payloadSize: number;      // 토큰 또는 바이트
  estimatedTokens: number;  // LLM 토큰 추정
  deadline: number;         // epoch ms
  grade: DataGrade;
  run: () => Promise<void>; // 실행 훅
  priority: number;         // 1~10, 기본 5
}

interface PricingSlot {
  startHour: number;        // 0~23
  endHour: number;          // 0~23 (24 exclusive)
  pricePerToken: number;    // 상대 비용
  capacityTokens: number;   // 시간대별 최대 처리 토큰
}

interface SchedulePlan {
  jobId: string;
  plannedAt: number;        // epoch ms
  slotHour: number;
  estimatedCost: number;
}

interface RunResult {
  jobId: string;
  startedAt: number;
  finishedAt: number;
  cost: number;
  status: 'ok' | 'error' | 'missed';
  error?: string;
}
```

## 스케줄링 알고리즘
```
1. addJob(j) — grade 검증
2. plan(now) →
   - 대기 jobs 순회 (우선순위 desc, 마감 asc)
   - 각 job에 대해 "현재 ~ 마감" 사이 시간대 후보 생성
   - 각 후보에서 pricing[ slot ].pricePerToken × estimatedTokens = 비용
   - 가장 저렴한 슬롯 선택 (capacity 초과 시 다음 slot)
   - capacity 차감 + 계획 등록
3. executeDue(now) — plannedAt <= now 인 job 실행
   - run() 호출
   - 실패 시 최대 3회 재시도 (지수 백오프)
   - 결과 저장
```

## 보안
- C/S 등급 job은 addJob에서 throw (`BATCH_GRADE_BLOCKED`)
- 감사: JOB_ADD / PLAN / EXECUTE / RETRY / MISS_DEADLINE / GRADE_BLOCK

## 리포트
`summary()` — 총 비용, 완료 수, 마감 미스 수, 시간대별 분포
