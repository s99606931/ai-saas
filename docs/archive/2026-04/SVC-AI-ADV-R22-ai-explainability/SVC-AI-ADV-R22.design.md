# SVC-AI-ADV-R22: AI Explainability DESIGN

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead (Opus)

## 아키텍처 선택: Option B — Pragmatic Balance

추론 체인 추적 + 근거 링크 + 신뢰도 계량 + 편향 모니터링

---

## Design Anchor

- **WHY**: AI 의사결정 투명성으로 공공기관 신뢰 확보. 행안부 AI 윤리 기준 준수
- **HOW**: 응답 생성 과정 단계별 기록 + 출처 명시 + 통계적 편향 탐지
- **CONSTRAINT**: CSAP D-06 판단 근거 감사 로그, D-12 AI 시스템 설명 문서

---

## §1 추론 체인 추적 (FR-ADV22.1)

ReasoningStep: stepId, type (retrieval|analysis|generation|validation), input, output, durationMs
ReasoningChain: 전체 추론 과정의 단계 배열
각 AI 호출 지점에서 자동 수집 (미들웨어 패턴)

## §2 근거 문서 링크 (FR-ADV22.2)

Citation: sourceId, sourceType, title, section, relevanceScore, quote
응답 텍스트에 인라인 각주 삽입: "... [1]" + 출처 목록

## §3 신뢰도 표시 (FR-ADV22.3)

ConfidenceScore: overall (0~1), dimensions { factual, contextual, linguistic }
계산: LLM 로그 확률 + 컨텍스트 일치도 + 출처 권위도 가중 평균
신뢰도 레벨: high (>= 0.8), medium (>= 0.5), low (< 0.5)

## §4 반사실 설명 (FR-ADV22.4)

CounterfactualExplanation: condition, alternativeResult, confidence
"만약 X 조건이 달랐다면, Y와 같은 결과가 나왔을 것입니다"

## §5 편향 탐지 (FR-ADV22.5)

모니터링 차원: 성별, 연령, 지역, 민원 유형
탐지 방법: 동일 질문 다른 인구통계 변수 → 응답 차이 통계 검정
임계값: 편향 점수 > 0.1 시 경고
