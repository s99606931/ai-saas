# SVC-AI-ADV-R202 Design — AI기반 API 게이트웨이 동적 라우팅

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 서비스 헬스 기반 지능형 트래픽 라우팅 |
| SCOPE | 구현 파일: `ai-dynamic-api-router.ts` |

## 라우팅 전략

| strategy | 선택 방식 |
|----------|---------|
| ROUND_ROBIN | 순환 인덱스 |
| LATENCY | 최소 latencyMs 엔드포인트 |
| WEIGHTED | weight 합산 후 랜덤 선택 |
| LEAST_CONN | 첫 번째 healthy 엔드포인트 |

- UNHEALTHY 엔드포인트 제외 (모두 UNHEALTHY면 fallback)

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R202.1 | registerEndpoint/registerRule | 등록 | D-12 |
| FR-R202.2 | route | ROUND_ROBIN | D-12 |
| FR-R202.3 | route | LATENCY 최적 | D-12 |
| FR-R202.4 | route | UNHEALTHY 제외 | D-08 |
| FR-R202.5 | getAuditLog | 감사 로그 | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 최초 작성 | ai-impl-a |
