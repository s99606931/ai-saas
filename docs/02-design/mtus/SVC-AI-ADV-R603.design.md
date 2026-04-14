# SVC-AI-ADV-R603 Design — AI기반 공공기관 데이터 공유 자동화 v2

## 인터페이스

```typescript
interface DataSharingRequest {
  requestId: string;
  dataGrade: 'C' | 'S' | 'O';
  requesterId: string;
  receiverAgencyId: string;
  dataCategory: string;
  hasConsent: boolean;
}

type SharingStatus = 'APPROVED' | 'PENDING_REVIEW' | 'BLOCKED';

interface DataSharingResult {
  requestId: string;
  status: SharingStatus;
  requesterIdMasked: string;
  receiverAgencyId: string;
}
```

## 핵심 알고리즘

- N2SF C/S → throw `BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`
- O등급: hasConsent→APPROVED / !hasConsent→PENDING_REVIEW
- requesterId 마스킹: 앞2자+***+뒤2자, 4자 미만→***
- 감사 로그: process 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
- N-05: C/S 등급 차단
