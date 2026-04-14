# SVC-AI-ADV-R608 Design — AI기반 클라우드 리소스 이상 탐지 v2

## 인터페이스

```typescript
interface CloudResource {
  resourceId: string;
  type: string;
  cpuUsage: number;
  networkEgressGB: number;
  unusualAccessCount: number;
}

type AnomalyType = 'CPU_SPIKE' | 'DATA_EXFIL' | 'INTRUSION' | 'NORMAL';
type ResourceSeverity = 'CRITICAL' | 'HIGH' | 'OK';

interface ResourceAnomalyResult {
  accountId: string;
  requiresImmediateAction: boolean;
  resources: { resourceId: string; anomalyType: AnomalyType; severity: ResourceSeverity }[];
  criticalCount: number;
}
```

## 핵심 알고리즘

- 이상 분류: cpuUsage>95→CPU_SPIKE / networkEgressGB>100→DATA_EXFIL / unusualAccessCount>50→INTRUSION / else NORMAL (우선순위: DATA_EXFIL>INTRUSION>CPU_SPIKE)
- 심각도: DATA_EXFIL||INTRUSION→CRITICAL / CPU_SPIKE→HIGH / NORMAL→OK
- requiresImmediateAction: criticalCount > 0
- 감사 로그: detect 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
