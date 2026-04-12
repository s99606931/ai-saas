# Design — SVC-AI-ADV-R160 Hallucination Scorer

## 아키텍처 옵션

| 옵션 | 장점 | 단점 | 선택 |
|------|------|------|------|
| 토큰 일치도 휴리스틱 | 빠름, 결정적 | 의미 판단 약함 | ★ Pragmatic |
| NLI 모델 | 정교 | 비용↑ | - |
| 외부 팩트체커 | 근거 검증 | 네트워크 의존 | - |

## 모듈 구조

```
hallucination-scorer.ts
├── ScoreLevel = 'low' | 'medium' | 'high'
├── ScoreResult { score: number, level: ScoreLevel, reasons: string[] }
├── HallucinationScorer
│   ├── constructor(opts)
│   ├── score(response, citations, grade)
│   ├── getStats(), getAuditLog()
│   └── (private) tokenize, computeOverlap, detectHedges
```

## 핵심 결정

- 토큰화: 공백/구두점 분리, 2글자 이상 필터
- 일치도 = (citations 토큰 합집합에 포함되는 response 토큰) / response 토큰 수
- 기본 점수 = 1 - overlap, hedge 비율 * 0.2 추가 가중치
- citations 비어있음 → 0.9
- 빈 응답 → empty_response throw

## Session Guide

- 파일 < 250 줄, 테스트 8+

## 추적성

- FR-R160.1~FR-R160.8 → 메서드 매핑
