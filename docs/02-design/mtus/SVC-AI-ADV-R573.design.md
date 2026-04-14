# SVC-AI-ADV-R573 Design — AI기반 서비스 비용 이상 탐지 v4

## 인터페이스

```typescript
interface ServiceCostEntry {
  serviceId: string;
  currentCost: number;
  baseline: number;
  category: string;
}

interface CostAnomalyItem {
  serviceId: string;
  isAnomaly: boolean;
  overrunRate: number;   // 소수점 1자리
}

type OverallStatus = 'CRITICAL' | 'WARNING' | 'NORMAL';

interface CostAnomalyV4Result {
  tenantId: string;
  overallStatus: OverallStatus;
  anomalies: CostAnomalyItem[];
  anomalyCount: number;
}
```

## 핵심 알고리즘

- 각 서비스 이상: currentCost > baseline × 1.3
- 초과율: (current-baseline)/baseline×100 (소수점 1자리)
- 전체 상태: 이상비율>0.5→CRITICAL / >0.2→WARNING / else NORMAL
- 감사 로그: detect 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
