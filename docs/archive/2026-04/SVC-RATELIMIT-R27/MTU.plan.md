# SVC-RATELIMIT-R27 Plan: Rate Limiter 라이브러리

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | API 남용 방지, 공정한 리소스 배분, SLA 보호 |
| 기술 | Sliding Window Counter 알고리즘, 테넌트별 독립 제한, Fastify 플러그인 |
| 보안 | CSAP D-08 접근 통제, DDoS 완화, 브루트포스 공격 방지 |
| 운영 | 메트릭 노출 (차단 횟수, 잔여 쿼터), 관리자 동적 설정 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 모든 17개 마이크로서비스에 API Rate Limiting 필요. CSAP D-08 접근 통제 필수 요건 |
| WHO | 플랫폼 운영자 (한도 설정), 테넌트 (공정 분배), 보안팀 (남용 탐지) |
| RISK | Rate Limiter 미적용 시 단일 테넌트의 과도한 사용으로 전체 서비스 품질 저하 |
| SUCCESS | 모든 API에 테넌트별/글로벌 Rate Limiting 적용, 429 응답 + Retry-After 헤더 |
| SCOPE | In-memory Sliding Window (Phase 1). Redis 분산 Rate Limiting은 Phase 2 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 | 검증 방법 |
|----|---------|---------|----------|
| FR-RL.1 | Sliding Window Counter 알고리즘 (요청 수 기반) | P0 | 단위 테스트 |
| FR-RL.2 | 테넌트별 독립 Rate Limit (키 기반 분리) | P0 | 단위 테스트 |
| FR-RL.3 | 429 Too Many Requests + Retry-After 헤더 | P0 | 단위 테스트 |
| FR-RL.4 | Rate Limit 메트릭 조회 (잔여 횟수, 리셋 시간) | P1 | 단위 테스트 |
| FR-RL.5 | 동적 설정 변경 (런타임 한도 조정) | P1 | 단위 테스트 |
| FR-RL.6 | Fastify 플러그인 통합 | P1 | 통합 테스트 |

---

## 추적성 매트릭스

| FR ID | Design 섹션 | 구현 파일 | 테스트 |
|-------|-----------|----------|--------|
| FR-RL.1 | 알고리즘 설계 | rate-limiter.ts | rate-limiter.test.ts |
| FR-RL.2 | 키 기반 분리 | rate-limiter.ts | rate-limiter.test.ts |
| FR-RL.3 | 응답 형식 | rate-limiter.ts | rate-limiter.test.ts |
| FR-RL.4 | 메트릭 | rate-limiter.ts | rate-limiter.test.ts |
| FR-RL.5 | 동적 설정 | rate-limiter.ts | rate-limiter.test.ts |
| FR-RL.6 | 플러그인 | rate-limit-plugin.ts | rate-limit-plugin.test.ts |
