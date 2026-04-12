# SVC-AI-ADV-R9: AI Observability

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | LLM 품질 메트릭(RAGAS), 프롬프트 A/B 테스트, 비용/레이턴시 모니터링으로 AI 서비스 품질을 지속 개선하고 운영 효율 극대화 |
| 기술 | LLM 전용 메트릭 수집기, 프롬프트 버전 관리(Git-like), RAG 자동 평가(Faithfulness/Relevancy/Context) |
| 보안 | 메트릭에 PII 미포함, 프롬프트 템플릿은 O등급 데이터만 포함, CSAP D-06 감사 |
| 운영 | Prometheus 호환 메트릭 노출, 실시간 대시보드, 품질 저하 자동 알림 |

---

## Context Anchor

### WHY
LLM 기반 서비스는 프롬프트 변경, 모델 업데이트, 데이터 변화에 따라 품질이 변동합니다. 체계적인 관찰가능성(Observability) 없이는 품질 저하를 감지할 수 없고, 프롬프트 개선 효과를 측정할 수 없습니다. 2026년 LLMOps 표준은 RAGAS 메트릭 자동 평가, 프롬프트 버전 관리, 모델 레이턴시/비용 실시간 추적을 포함합니다.

### WHO
- AI 엔지니어: 프롬프트 개선, A/B 테스트 결과 분석
- 운영팀: 비용/레이턴시 모니터링, 이상 감지
- 감리원: AI 서비스 품질 증빙 (RAGAS 점수)

### RISK
- R1: 메트릭 수집 오버헤드 (완화: 비동기 수집, 샘플링)
- R2: 프롬프트 버전 충돌 (완화: 불변 버전 + 롤백)
- R3: RAGAS 평가 비용 (완화: 샘플 기반, 배치 평가)

### SUCCESS
- SC-1: LLM 메트릭 수집 — 레이턴시, 토큰, 에러율, TTFT
- SC-2: 프롬프트 버전 관리 — 불변 버전, A/B 분배, 롤백
- SC-3: RAG 자동 평가 — Faithfulness, Answer Relevancy, Context Precision

### SCOPE
- IN: LLM 메트릭, 프롬프트 버전 관리, RAG 평가 (RAGAS)
- OUT: 외부 APM 통합, 실시간 대시보드 UI

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-ADV9.1 | LLM 호출 메트릭 수집 — TTFT, 총 레이턴시, 토큰 수, 에러율 | P0 |
| FR-ADV9.2 | 메트릭 집계 — 모델별, 테넌트별, 시간대별 | P0 |
| FR-ADV9.3 | Prometheus 호환 메트릭 노출 | P1 |
| FR-ADV9.4 | 프롬프트 버전 관리 — 등록, 조회, 활성/비활성 | P0 |
| FR-ADV9.5 | 프롬프트 A/B 테스트 — 트래픽 분배, 결과 비교 | P1 |
| FR-ADV9.6 | RAG Faithfulness 평가 — 응답이 컨텍스트에 근거하는지 | P0 |
| FR-ADV9.7 | RAG Answer Relevancy 평가 — 응답이 질문에 적절한지 | P0 |
| FR-ADV9.8 | RAG Context Precision 평가 — 검색된 컨텍스트 품질 | P1 |
| FR-ADV9.9 | 품질 이상 감지 — 메트릭 임계값 기반 알림 | P1 |

---

## 추적성 매트릭스

| FR ID | 구현 파일 | CSAP |
|-------|----------|------|
| FR-ADV9.1~9.3 | llm-metrics.ts | D-06 |
| FR-ADV9.4~9.5 | prompt-versioning.ts | D-12 |
| FR-ADV9.6~9.9 | rag-evaluator.ts | D-12 |

---

## 산출물 목록

| 산출물 | 경로 |
|--------|------|
| llm-metrics.ts | platform/services/ai-service/src/lib/llm-metrics.ts |
| prompt-versioning.ts | platform/services/ai-service/src/lib/prompt-versioning.ts |
| rag-evaluator.ts | platform/services/ai-service/src/lib/rag-evaluator.ts |
