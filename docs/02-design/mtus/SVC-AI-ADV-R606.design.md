# SVC-AI-ADV-R606 Design — AI기반 자동 서비스 품질 보증 v3

## 인터페이스

```typescript
interface QualityAssuranceInput {
  serviceId: string;
  availability: number;
  responseTimeMs: number;
  errorRate: number;
  slaAvailability: number;
  slaResponseTimeMs: number;
  slaErrorRate: number;
}

type QASeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'OK';

interface QualityAssuranceResult {
  serviceId: string;
  violationCount: number;
  severity: QASeverity;
  requiresEscalation: boolean;
  violations: { metric: string; actual: number; sla: number }[];
}
```

## 핵심 알고리즘

- SLA 위반: availability<slaAvailability / responseTime>slaResponseTimeMs / errorRate>slaErrorRate
- 심각도: 3개→CRITICAL / 2개→HIGH / 1개→MEDIUM / 0개→OK
- 에스컬레이션: CRITICAL||HIGH
- 감사 로그: assess 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
