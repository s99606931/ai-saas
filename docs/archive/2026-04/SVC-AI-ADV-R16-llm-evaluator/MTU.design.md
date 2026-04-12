# SVC-AI-ADV-R16: LLM Evaluation Framework DESIGN

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead (Opus)

## 아키텍처 선택: Option B — Pragmatic Balance

로컬 LLM-as-a-Judge + RAGAS 스타일 메트릭 + 시계열 저장

---

## Design Anchor

- **WHY**: AI 응답 품질을 객관적/자동으로 측정하여 서비스 신뢰성 보장
- **HOW**: Judge LLM이 다차원 평가 + RAGAS 메트릭으로 RAG 품질 정량화
- **CONSTRAINT**: N2SF O등급만 평가 대상, 평가 결과 전수 감사 로깅

---

## §1 RAG 품질 평가 (FR-ADV16.1)

RAGAS 프레임워크 핵심 3대 메트릭:
- **Faithfulness**: 응답이 컨텍스트에 충실한 정도 (환각 탐지)
- **Answer Relevancy**: 응답이 질문에 관련된 정도
- **Context Precision**: 검색된 컨텍스트의 정밀도

각 메트릭은 0.0~1.0 범위, 임계값 기본 0.7

## §2 LLM-as-a-Judge (FR-ADV16.2)

4차원 평가:
- 정확성 (factual correctness): 사실 관계 정확도
- 유용성 (helpfulness): 사용자 요구 충족 정도
- 안전성 (safety): 유해/부적절 콘텐츠 없음
- 한국어 품질 (korean quality): 자연스러운 한국어 표현

Judge 프롬프트: 구조화된 루브릭 + JSON 출력 + 근거 설명

## §3 메트릭 수집기 (FR-ADV16.3)

시계열 데이터 구조: 모델명, 프롬프트 버전, 메트릭명, 값, 타임스탬프

## §4 벤치마크 관리 (FR-ADV16.4)

골든 데이터셋: 질문-컨텍스트-기대답변 트리플
회귀 테스트: 벤치마크 점수가 이전 대비 5% 이상 하락 시 경고

## §5 평가 보고서 (FR-ADV16.5)

프롬프트/모델별 평가 점수 집계 + 추세 시각화 데이터
