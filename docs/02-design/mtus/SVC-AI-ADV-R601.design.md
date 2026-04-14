# SVC-AI-ADV-R601 Design — AI기반 공공기관 지능형 알림 관리 v2

## 인터페이스

```typescript
interface NotificationInput {
  notificationId: string;
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  recipientCount: number;
  isDuplicate: boolean;
}

type DeliveryChannel = 'SMS+EMAIL' | 'EMAIL' | 'APP' | 'SUPPRESS';

interface NotificationResult {
  notificationId: string;
  priorityScore: number;
  deliveryChannel: DeliveryChannel;
  isSuppressed: boolean;
}
```

## 핵심 알고리즘

- 우선순위 점수 = (CRITICAL→100/HIGH→70/MEDIUM→40/LOW→10) + min(recipientCount/100,1)×20 - (isDuplicate?30:0)
- 채널: >=80→SMS+EMAIL / >=50→EMAIL / >=20→APP / else SUPPRESS
- 억제: deliveryChannel==='SUPPRESS'
- 감사 로그: process 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
