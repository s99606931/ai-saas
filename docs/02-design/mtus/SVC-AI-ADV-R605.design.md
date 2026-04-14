# SVC-AI-ADV-R605 Design — AI기반 공공기관 내부 감사 보고 v3

## 인터페이스

```typescript
interface AuditFinding {
  findingId: string;
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  isRecurring: boolean;
}

type WeightedSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface AuditReportResult {
  auditId: string;
  agencyId: string;
  auditScore: number;      // 0~100
  immediateCount: number;
  findings: { findingId: string; weightedSeverity: WeightedSeverity; requiresImmediate: boolean }[];
}
```

## 핵심 알고리즘

- 가중 심각도: isRecurring → LOW→MEDIUM / MEDIUM→HIGH / HIGH→CRITICAL / CRITICAL 유지
- 즉시 시정: weightedSeverity === 'CRITICAL' || 'HIGH'
- 감사 점수 = (1 - immediateCount/totalCount) × 100 (총수=0이면 100)
- 감사 로그: report 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
