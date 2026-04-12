# SVC-APIGW-R22 Plan -- API Gateway Advanced

> Design Ref: SVC-APIGW-R22 Plan
> CSAP: D-08 접근 통제, D-10 접근 제어, D-12 시스템 개발 보안
> 작성일: 2026-04-09

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | API Gateway의 고급 기능으로 응답 성능 향상, 백엔드 부하 감소, 사용량 추적 |
| 기술 | LRU 응답 캐싱 + 요청 집계(Request Aggregation) + 사용량 분석(Usage Analytics) |
| 규제 | CSAP D-10: API별 접근 제어, D-12: 요청 검증, D-08: 인가 추적 |
| 운영 | 캐시 적중률 모니터링, 사용량 리포트, 서비스별 호출 통계 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | API Gateway가 단순 프록시를 넘어 캐싱/집계/분석 기능 필요 |
| WHO | 서비스 개발자 (캐싱 설정), 운영자 (사용량 모니터링), 관리자 (리포트) |
| RISK | 캐시 일관성 문제, 메모리 과사용, 집계 실패 시 부분 응답 |
| SUCCESS | 캐시 적중률 개선, 사용량 실시간 추적, 집계 요청 지원 |
| SCOPE | @public-saas/api-gateway-advanced 패키지 + Fastify 플러그인 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | 검증 기준 |
|----|---------|---------|----------|
| FR-GW.1 | LRU 응답 캐시 (TTL 기반) | P0 | 동일 요청에 캐시 히트, TTL 만료 시 미스 |
| FR-GW.2 | 캐시 키 전략 (URL + 헤더 기반) | P0 | 테넌트별 캐시 분리 |
| FR-GW.3 | 사용량 분석 (엔드포인트별 호출 통계) | P0 | 엔드포인트, 메서드, 상태코드별 집계 |
| FR-GW.4 | 요청 집계 (여러 백엔드 동시 호출) | P1 | N개 백엔드 호출 결과를 하나로 병합 |
| FR-GW.5 | Fastify 플러그인 통합 | P1 | 플러그인 등록, /gateway/stats, /gateway/cache/stats |
| FR-GW.6 | 캐시 무효화 (수동/TTL) | P2 | 특정 키 또는 패턴 무효화 |

## 산출물

| 파일 | 설명 |
|------|------|
| `platform/packages/api-gateway-advanced/src/response-cache.ts` | LRU 응답 캐시 |
| `platform/packages/api-gateway-advanced/src/usage-analytics.ts` | 사용량 분석 |
| `platform/packages/api-gateway-advanced/src/request-aggregator.ts` | 요청 집계 |
| `platform/packages/api-gateway-advanced/src/gateway-plugin.ts` | Fastify 플러그인 |
| `platform/packages/api-gateway-advanced/src/index.ts` | 엔트리포인트 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-09 | 초안 작성 | PM Lead |
