# SVC-AI-ADV-R539 Design — AI기반 자동 장애 근원 분석 v2

## 인터페이스

```typescript
interface IncidentInput {
  incidentId: string;
  affectedService: string;
  symptoms: string[];
  errorRate: number;     // 0~1
  latencySpike: number;  // ms
  memUsage: number;      // 0~100
}

interface RootCauseResult {
  incidentId: string;
  rootCause: 'CODE_ERROR' | 'RESOURCE_EXHAUSTION' | 'MEMORY_LEAK' | 'UNKNOWN';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  recommendation: 'ROLLBACK' | 'SCALE_OUT' | 'RESTART' | 'MONITOR';
  affectedService: string;
}
```

## 핵심 알고리즘

- 근원 분류: errorRate>0.5→CODE_ERROR / latencySpike>5000→RESOURCE_EXHAUSTION / memUsage>90→MEMORY_LEAK / else UNKNOWN (우선순위 순)
- 심각도: CODE_ERROR&&errorRate>0.8→CRITICAL / RESOURCE_EXHAUSTION||CODE_ERROR→HIGH / MEMORY_LEAK→MEDIUM / else LOW
- 복구 권고: CRITICAL→ROLLBACK / HIGH→SCALE_OUT / MEDIUM→RESTART / LOW→MONITOR
- 감사 로그: analyze 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
