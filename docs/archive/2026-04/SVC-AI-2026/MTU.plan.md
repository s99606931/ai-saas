# Plan: 2026년 최신 AI 기술 통합 서비스

> MTU ID: SVC-AI-2026 | 작성일: 2026-04-10 | 복잡도: HIGH

## Executive Summary

| 관점 | 내용 |
|------|------|
| WHY | 공공기관 SaaS에 2026년 최신 AI 기술을 통합하여 업무 자동화 및 지능화 구현 |
| WHO | 공공기관 담당자 + 개발자 + AI 운영팀 |
| RISK | LLM 비결정성, 공공데이터 보안(N2SF), 응답 품질 보장 |
| SUCCESS | RAG Q&A 정확도 >85%, 에이전트 태스크 완료율 >90%, CSAP 100% 준수 |
| SCOPE | ai-service 신규 모듈 + LM Studio 연동 (외부망 차단 로컬 LLM) |

## 2026년 적용 AI 기술 스택

| 기술 | 설명 | 적용 이유 |
|------|------|---------|
| RAG 2.0 | 하이브리드 검색(시맨틱+키워드) + 리랭킹 | 공공문서 정확한 Q&A |
| Agentic AI | ReAct 패턴 + Tool Use | 반복 업무 자동화 |
| Structured Outputs | JSON 스키마 제약 LLM 응답 | 민원 분류, 데이터 추출 |
| Long-Context (128k) | Gemma4 128k 컨텍스트 | 긴 공공문서 전체 분석 |
| Function Calling | OpenAI 호환 도구 호출 | 시스템 연동 자동화 |
| AI Guardrails v2 | 고급 안전장치 + 편향 감지 | 공공 서비스 신뢰성 |
| Multimodal RAG | 이미지+텍스트 문서 이해 | 공문서/도면 분석 |

## 요구사항

### FR-AI26.1: RAG 엔진 (공공문서 지식베이스 Q&A)
- 문서 업로드 → 청킹 → 임베딩 → 저장
- 질문 → 시맨틱 검색 → 컨텍스트 주입 → LLM 생성
- 출처 인용 포함 (신뢰성 보장)
- 지원 형식: TXT, MD, JSON, 한국어 텍스트

### FR-AI26.2: AI 에이전트 (ReAct 패턴)
- 다단계 태스크 자율 실행
- 도구 등록/호출 (Tool Registry)
- 실행 추적 + 감사 로그
- 최대 10단계 반복 (무한 루프 방지)

### FR-AI26.3: Structured Outputs (구조화 출력)
- JSON 스키마 기반 LLM 응답 강제
- 민원 분류: 카테고리 + 우선순위 + 담당부서
- 문서 요약: 핵심 3줄 + 키워드 + 위험도

### FR-AI26.4: 문서 AI (Long-Context 처리)
- PDF/텍스트 전체 분석 (128k 컨텍스트 활용)
- 요약, 핵심 추출, 위험 조항 탐지
- 공공문서 표준 분석 (행안부 공문 형식)

### FR-AI26.5: AI Workflow (업무 자동화)
- 미리 정의된 업무 흐름 자동 실행
- 트리거: API 호출 / 스케줄 / 이벤트
- 중간 결과 저장 + 실패 복구

## 추적성 매트릭스

| FR | 핸들러 | 테스트 | CSAP |
|----|--------|--------|------|
| FR-AI26.1 | ai-rag.handler.ts | rag.test.ts | N2SF N-05, D-06 |
| FR-AI26.2 | ai-agent.handler.ts | agent.test.ts | D-06, D-08 |
| FR-AI26.3 | ai-structured.handler.ts | structured.test.ts | D-12 |
| FR-AI26.4 | ai-document.handler.ts | document.test.ts | N2SF N-05 |
| FR-AI26.5 | ai-workflow.handler.ts | workflow.test.ts | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 | PM |
