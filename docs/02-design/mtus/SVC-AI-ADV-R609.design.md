# SVC-AI-ADV-R609 Design — AI기반 공공 서비스 비교 분석 v2

## 인터페이스

```typescript
interface ServiceComparison {
  serviceId: string;
  usageCount: number;
  satisfactionScore: number;  // 0~5
  costEfficiency: number;     // 0~100
  accessibilityScore: number; // 0~100
}

type ComparisonGrade = 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR';

interface ComparisonResult {
  analysisId: string;
  services: { serviceId: string; score: number; grade: ComparisonGrade }[];
  topService: string;
  bottomService: string;
  avgScore: number;
}
```

## 핵심 알고리즘

- 종합 점수 = min(usageCount/10000,1)×100×0.3 + satisfactionScore/5×100×0.3 + costEfficiency×0.2 + accessibilityScore×0.2
- 등급: >=80→EXCELLENT / >=60→GOOD / >=40→AVERAGE / else POOR
- topService: 점수 최고 / bottomService: 점수 최저
- avgScore: 전체 평균 (소수점 2자리)
- 감사 로그: analyze 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
