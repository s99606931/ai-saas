# Design — SVC-AI-ADV-R163 Citizen Feedback Analyzer

## 아키텍처 옵션

| 옵션 | 장점 | 단점 | 선택 |
|------|------|------|------|
| 키워드 사전 룰 기반 | 설명 가능, 외부 의존 없음 | 정확도 70%대 | ★ Pragmatic |
| 임베딩 기반 분류 | 높은 정확도 | 모델 의존 | - |
| LLM 프롬프트 분류 | 최고 정확도 | 비용/지연 | - |

## 모듈 구조

```
citizen-feedback-analyzer-r163.ts
├── Sentiment = 'positive'|'neutral'|'negative'
├── Topic = 'welfare'|'tax'|'traffic'|'environment'|'safety'|'other'
├── Analysis { id, sentiment, topic, urgency, at }
├── CitizenFeedbackAnalyzerR163
│   ├── analyze(text, grade)
│   ├── getTrend()
│   ├── getUrgentQueue()
│   ├── getStats(), getAuditLog()
```

## 핵심 결정

- 감성 점수: 긍정/부정 키워드 개수 차이
- 주제: 주제별 키워드 사전에서 최대 매칭
- 긴급도 = 부정점수 * 2 + 긴급키워드개수 * 30 (최대 100)
- ID는 incremental (분석 순번)

## Session Guide

- 파일 < 300 줄, 테스트 10+

## 추적성

- FR-R163.1~FR-R163.8 → 메서드 매핑
