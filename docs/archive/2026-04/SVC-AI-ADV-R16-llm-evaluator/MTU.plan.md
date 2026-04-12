# SVC-AI-ADV-R16: LLM Evaluation Framework (LLM 평가 프레임워크)

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | AI 응답 품질을 자동 평가하여 서비스 신뢰성 보장. LLM-as-a-Judge 패턴으로 인간 평가 500x 비용 절감 |
| 기술 | RAGAS 스타일 RAG 평가 + LLM-as-a-Judge + 메트릭 수집 + 벤치마크 관리 |
| 보안 | CSAP D-06 감사 로그 (평가 결과 전수 기록), N2SF O등급 데이터만 평가 |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-ADV16.1 | RAG 품질 평가 — Faithfulness, Answer Relevancy, Context Precision | P0 |
| FR-ADV16.2 | LLM-as-a-Judge — 다차원 점수 (정확성, 유용성, 안전성, 한국어 품질) | P0 |
| FR-ADV16.3 | 메트릭 수집기 — 평가 결과 시계열 저장 + 추세 분석 | P0 |
| FR-ADV16.4 | 벤치마크 관리 — 골든 데이터셋 + 회귀 테스트 자동화 | P1 |
| FR-ADV16.5 | 평가 보고서 — 모델/프롬프트별 품질 대시보드 데이터 | P1 |
| FR-ADV16.6 | 인간 평가 정렬 — Judge 모델과 인간 판단 일치율 추적 | P2 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| llm-evaluator.ts | platform/services/ai-service/src/lib/llm-evaluator.ts |
