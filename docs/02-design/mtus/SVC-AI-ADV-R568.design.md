# SVC-AI-ADV-R568 Design — AI기반 실시간 서비스 품질 예측 v2

## 인터페이스

```typescript
interface QualityPredictorInput {
  serviceId: string;
  cpuTrend: number[];      // 최소 3개
  memTrend: number[];      // 최소 3개
  currentErrorRate: number;
  slaTarget: number;       // 0~1
}

type QualityPrediction = 'CRITICAL' | 'WARNING' | 'STABLE';

interface QualityPredictResult {
  serviceId: string;
  cpuRisk: boolean;
  memRisk: boolean;
  prediction: QualityPrediction;
  recommendation: string;
}
```

## 핵심 알고리즘

- CPU 위험: 마지막 3개 평균 > 70
- 메모리 위험: 마지막 3개 평균 > 80
- 예측 등급: cpuRisk&&memRisk→CRITICAL / cpuRisk||memRisk||currentErrorRate>slaTarget→WARNING / else STABLE
- 감사 로그: predict 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
