# SVC-AI-ADV-R433 Design — Online Voting Integrity Verifier AI

Plan Ref: SVC-AI-ADV-R433.plan.md

## 인터페이스
```ts
export interface VoteEvent {
  readonly voteId: string;
  readonly voterId: string;
  readonly ip: string;
  readonly timestamp: string;
}
export interface IntegrityReport {
  readonly suspicious: readonly { voteId: string; reasons: readonly string[] }[];
  readonly totalScanned: number;
  readonly flaggedCount: number;
}
```

## 알고리즘
1. voterId별 카운트 → >1 DUPLICATE
2. ip별 카운트 → >5 SUSPICIOUS_IP
3. 시간 정렬 후 voterId별 이전-현재 간격 계산 → <2000ms BOT_SPEED
4. 중복 voteId는 한 항목에 사유 병합
