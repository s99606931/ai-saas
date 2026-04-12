# MTU-N377-chaos-scenario-generator: 카오스 시나리오 생성기 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-11 | **작성자**: PM Lead (자율)

## Executive Summary

| 관점 | 결정 |
|------|------|
| 비즈니스 | 카오스 시나리오 생성기 모듈 |
| 기술 | 단일 lib 모듈 + Service 클래스 |
| 보안 | N2SF O등급, 감사 로그 전수 |
| 운영 | ai-service/lib, TypeScript strict |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | Plan 참조 |
| WHO | 공공기관 운영/개발팀 |
| RISK | 테넌트 격리 실패, 감사 로그 누락 |
| SUCCESS | Plan SC 달성 + 단위 테스트 통과 |
| SCOPE | Plan 참조 |

## 아키텍처 (Pragmatic Balance)

**선택**: 단일 lib 모듈 `platform/services/ai-service/src/lib/chaos-scenario-generator.ts`

## FR 매핑

| FR | CSAP |
|----|------|
| FR-N377.1~5 | D-06 |

## 추적성 매트릭스

| FR ID | 구현 | 테스트 |
|-------|------|--------|
| FR-N377.1~5 | chaos-scenario-generator.ts | __tests__/chaos-scenario-generator.test.ts |

## Design Anchor

- Module: `platform/services/ai-service/src/lib/chaos-scenario-generator.ts`
- Test: `platform/services/ai-service/src/lib/__tests__/chaos-scenario-generator.test.ts`
- Q-Gate: G1~G7 PASS
