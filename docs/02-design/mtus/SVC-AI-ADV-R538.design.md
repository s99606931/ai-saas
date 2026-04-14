# SVC-AI-ADV-R538 Design — 공공기관 서비스 혁신 지표 분석

## 인터페이스

```typescript
interface InnovationInput {
  agencyId: string;
  digitalServiceRate: number;   // 0~100
  processAutomationRate: number; // 0~100
  dataOpenRate: number;          // 0~100
  citizenSatisfaction: number;   // 0~100
}

interface InnovationResult {
  agencyId: string;
  innovationIndex: number;       // 0~100
  grade: 'INNOVATING' | 'ADVANCING' | 'DEVELOPING' | 'LAGGING';
  lowestMetric: string;
  recommendation: string;
}
```

## 핵심 알고리즘

- 혁신 지수 = digitalServiceRate×0.3 + processAutomationRate×0.3 + dataOpenRate×0.2 + citizenSatisfaction×0.2
- 등급: ≥80→INNOVATING / ≥60→ADVANCING / ≥40→DEVELOPING / else LAGGING
- 최저 지표: 4개 항목 중 가장 낮은 값의 필드명 반환
- 감사 로그: analyze 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
