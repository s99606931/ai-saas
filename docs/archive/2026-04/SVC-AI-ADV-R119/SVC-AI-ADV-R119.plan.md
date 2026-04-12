# SVC-AI-ADV-R119 — AI Load Balancer

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: PM Lead
> 원 요청 번호: R119

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 다수 AI 모델/엔드포인트 간 요청 부하 분산 — 모델별 부하·비용·레이턴시 균형 |
| 품질 | 과부하 모델 자동 회피, 실패 시 fallback, p95 레이턴시 추적 |
| 보안 | 등급 guard + 엔드포인트별 정책 격리 |
| 비용 | 저비용 모델 우선 라우팅 + 예산 초과 차단 |

## Context Anchor

- **WHY**: 여러 AI 백엔드(로컬 LM Studio, 외부 API, 특화 모델) 사용 시 무작정 라우팅하면 일부 모델이 과부하 또는 비용 폭증
- **WHO**: ai-gateway, 챗봇, RAG, 에이전트 오케스트레이션
- **RISK**: 부하 편향 → weighted round-robin + 부하 기반 동적 조정
- **SUCCESS**: 모델 선택 전략 pluggable, 헬스체크/서킷브레이커 연동, 비용/레이턴시 메트릭 수집
- **SCOPE**: In — 라우팅 전략·메트릭·fallback. Out — 실제 모델 호출(호출자 책임)

## 요구사항

- **FR-R119.1**: 여러 백엔드 등록 (id, weight, maxConcurrency, costPerToken)
- **FR-R119.2**: 전략 선택 — round-robin / weighted / least-loaded / cost-optimal / latency-optimal
- **FR-R119.3**: 동시성 제어 (inFlight 카운터 + maxConcurrency)
- **FR-R119.4**: 백엔드 헬스 상태 (healthy/degraded/down)
- **FR-R119.5**: 실패 시 fallback 체인
- **FR-R119.6**: 레이턴시/성공률/비용 메트릭 수집
- **FR-R119.7**: N2SF C/S 등급 차단
- **FR-R119.8**: `getAuditLog()` 필수
- **NFR-R119.1**: TypeScript strict 0, 테스트 80%+
- **NFR-R119.2**: 선택 로직 1ms 이내

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R119.1~6 | ai-load-balancer.ts | .test.ts | - |
| FR-R119.7 | grade guard | test | N2SF N-05 |
| FR-R119.8 | auditLog | test | D-06 |
