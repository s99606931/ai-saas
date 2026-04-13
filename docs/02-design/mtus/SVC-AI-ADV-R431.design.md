# SVC-AI-ADV-R431 Design — Resident Registration Auto Reviewer AI

Plan Ref: SVC-AI-ADV-R431.plan.md

## 인터페이스
```ts
export type Decision = 'APPROVED' | 'HOLD' | 'REJECTED';
export interface Application {
  readonly name: string;
  readonly rrn: string;           // 주민번호
  readonly address: string;
  readonly reason: string;
  readonly evidenceCount: number;
  readonly lastChangeDate: string; // ISO
}
export interface Review {
  readonly decision: Decision;
  readonly reasons: readonly string[];
}
```

## 알고리즘
1. 필수 필드 검증 (비어있으면 REJECTED)
2. 주민번호 정규식 `^\d{6}-\d{7}$` 검증
3. 마지막 변경일로부터 30일 경과 확인
4. 증빙 2개 미만 → HOLD
5. 모든 조건 충족 → APPROVED
