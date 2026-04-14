# SVC-AI-ADV-R546 Design — 공공 서비스 채널 분석 v3

## 인터페이스

```typescript
interface ChannelData {
  channelType: string;
  visitCount: number;
  completionRate: number;  // 0~1
  avgSatisfaction: number; // 0~5
}

interface ChannelAnalysisResult {
  agencyId: string;
  channels: { channelType: string; score: number; grade: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' }[];
  bestChannel: string;
  worstChannel: string;
}
```

## 핵심 알고리즘

- 채널 점수 = completionRate×0.5 + (avgSatisfaction/5)×0.3 + min(visitCount/10000,1)×0.2
- 등급: ≥0.8→EXCELLENT / ≥0.6→GOOD / ≥0.4→FAIR / else POOR
- 최우수: 점수 최고 채널 / 최저: 점수 최저 채널
- 감사 로그: analyze 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
