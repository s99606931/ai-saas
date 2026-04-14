# SVC-AI-ADV-R480 Design — public-complaint-classifier-v3.ts

Plan Ref: SVC-AI-ADV-R480.plan.md

```ts
export type Urgency = 'low' | 'normal' | 'high' | 'emergency';
export type ComplaintCategory = 'TRAFFIC' | 'ENVIRONMENT' | 'WELFARE' | 'SAFETY' | 'OTHER';
export interface Complaint {
  readonly complaintId: string;
  readonly content: string;
  readonly submitterId: string;
  readonly urgency: Urgency;
}
export interface ClassifiedComplaint {
  readonly complaintId: string;
  readonly category: ComplaintCategory;
  readonly priority: number;   // 1=highest
  readonly maskedSubmitterId: string;
}
```

keywords → category:
  도로|교통|버스|신호|주차 → TRAFFIC
  환경|쓰레기|소음|악취|오염 → ENVIRONMENT
  복지|노인|장애|의료|지원 → WELFARE
  안전|화재|범죄|위험|사고 → SAFETY
  (none matched) → OTHER

priority: emergency=1, high=2, normal=3, low=4
submitterId 마스킹: 앞2자 + '*'.repeat(len-4) + 뒤2자 (len>=4), 짧으면 '***'
