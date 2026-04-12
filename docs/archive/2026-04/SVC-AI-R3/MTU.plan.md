# Plan: ai-service 라운드 3 고도화

> MTU ID: SVC-AI-R3 | 작성일: 2026-04-10 | 복잡도: HIGH

## Executive Summary

| 관점 | 내용 |
|------|------|
| WHY | LM Studio 실제 연결 완료 후 서비스 품질 고도화 필요 |
| WHO | 공공기관 SaaS 테넌트 사용자 + AI 운영팀 |
| RISK | 스트리밍 SSE 연결 관리, 임베딩 벡터 저장 용량, 응답 캐싱 데이터 등급 |
| SUCCESS | 스트리밍 TTFB < 1초, 임베딩 API 동작, 모델 라우팅 정확도 100% |
| SCOPE | ai-service 내부 + LM Studio 제공자 확장 |

## 요구사항

### FR-AI-R3.1: SSE 스트리밍 응답
- POST /ai/chat/stream — Server-Sent Events (SSE) 형식
- 실시간 토큰 단위 응답 전송
- 스트림 중단(abort) 처리 + 감사 로그

### FR-AI-R3.2: 임베딩 API
- POST /ai/embed — 텍스트 배열 → 벡터 배열
- 지원 모델: text-embedding-qwen3-embedding-0.6b, text-embedding-nomic-embed-text-v1.5
- N2SF O등급 데이터 + PII 마스킹 필수

### FR-AI-R3.3: 스마트 모델 라우팅
- 요청 유형(chat/embed/multimodal) 자동 감지
- DB 모델 레코드의 modelType 필드 기반 라우팅
- 폴백: 요청 유형에 맞는 기본 모델 자동 선택

### FR-AI-R3.4: LLM 제공자 헬스체크
- GET /ai/provider/health — 현재 LLM 서버 상태 확인
- 모델 목록 조회 + 응답 시간 측정
- CSAP D-07: 가용성 모니터링

### FR-AI-R3.5: 응답 캐싱 (선택적)
- 동일 프롬프트 + 동일 모델 → Redis 캐시 (TTL 5분)
- N2SF O등급 데이터만 캐싱 허용
- 캐시 히트 시 감사 로그에 cache_hit 기록

## 추적성 매트릭스

| FR | 설계 파일 | 테스트 | CSAP |
|----|----------|--------|------|
| FR-AI-R3.1 | src/handlers/ai-stream.handler.ts | tests/integration/ai-stream.test.ts | D-06, D-10 |
| FR-AI-R3.2 | src/handlers/ai-embed.handler.ts | tests/unit/ai-embed.test.ts | N2SF N-05 |
| FR-AI-R3.3 | src/lib/model-router.ts | tests/unit/model-router.test.ts | D-08 |
| FR-AI-R3.4 | src/handlers/ai-provider.handler.ts | tests/integration/ai-provider.test.ts | D-07 |
| FR-AI-R3.5 | src/lib/response-cache.ts | tests/unit/response-cache.test.ts | N2SF N-05 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM |
