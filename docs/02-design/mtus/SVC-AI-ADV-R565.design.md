# SVC-AI-ADV-R565 Design — AI기반 공공기관 의사결정 자동화 v2

## 인터페이스

```typescript
interface DecisionRequest {
  requestId: string;
  category: string;
  amount: number;
  requesterGrade: string;   // '1'~'9' (숫자 문자열, 클수록 상위)
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  hasAttachments: boolean;
}

type ApprovalRoute = 'AUTO' | 'FAST_TRACK' | 'STANDARD';

interface DecisionResult {
  requestId: string;
  canAutoApprove: boolean;
  approvalRoute: ApprovalRoute;
  estimatedDays: number;
}
```

## 핵심 알고리즘

- 자동 결재 가능: amount<=1000000 && requesterGrade>='3' && hasAttachments===true
- 결재 경로: canAutoApprove→AUTO / urgency==='HIGH'→FAST_TRACK / else STANDARD
- 예상 처리일: AUTO→0 / FAST_TRACK→1 / STANDARD→3
- 감사 로그: process 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
