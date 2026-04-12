# SVC-AI-ADV-R251 — KOSIS 통계 분석 엔진 Design

> 작성일: 2026-04-13 | 버전: 1.0.0

## 컴포넌트 설계

```
KosisStatisticsAnalyzer
├── registerSeries(seriesId, name, dataPoints[], unit, grade)
├── analyzeTrend(seriesId): TrendAnalysis
├── detectOutliers(seriesId): Outlier[]
├── generateInsights(seriesId): Insight[]
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **선형 추세**: 최소제곱법 기울기 계산, 양수→상승, 음수→하락
- **Z-score**: (값 − 평균) / 표준편차, |z| ≥ 2 → 이상치
- **변동성**: 표준편차 / 평균 (변동계수)
- **인사이트**: YoY 증감률, 최대/최소 연도, 변동성 수준

## CSAP D-09 준수

- 시계열 등록·분석 감사 로그
- N2SF C/S 등급 차단
