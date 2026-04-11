# SVC-AI-ADV-R38: 엣지 AI 추론 (Edge Inference)

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead (Opus)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 망분리 환경에서 외부 유출 0인 AI 서비스 제공 |
| 기술 | Ollama/llama.cpp 연동 온프레미스 추론 + OpenAI 호환 API |
| 보안 | N2SF C/S등급 데이터도 로컬에서만 처리, 외부 유출 완전 차단 |
| 운영 | 경량 모델 자동 관리 + 모델 전환 + 성능 모니터링 |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-ADV38.1 | Ollama 클라이언트 — Ollama REST API 연동 (생성, 채팅, 임베딩) | P0 |
| FR-ADV38.2 | 모델 관리 — 로컬 모델 목록, 풀, 삭제, 상태 확인 | P0 |
| FR-ADV38.3 | 추론 실행 — 텍스트 생성, 채팅 완성, 임베딩 생성 | P0 |
| FR-ADV38.4 | 스트리밍 응답 — 토큰 단위 스트리밍 출력 | P1 |
| FR-ADV38.5 | 폴백 라우팅 — 로컬 실패 시 외부 API 폴백 (O등급 데이터만) | P1 |
| FR-ADV38.6 | 성능 모니터링 — 추론 속도, 메모리 사용량, 토큰/초 측정 | P1 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| edge-inference.ts | platform/services/ai-service/src/lib/edge-inference.ts |
| local-model-runner.ts | platform/services/ai-service/src/lib/local-model-runner.ts |
