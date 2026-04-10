# SVC-AUDITCHAIN-R21 Plan -- SHA-256 해시 체인 감사 로그

> Design Ref: SVC-AUDITCHAIN-R21 Plan
> CSAP: D-06 침해사고 관리 (감사 로그 무결성)
> 작성일: 2026-04-09

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | CSAP D-06 감사 로그 무결성 요건 충족 -- 변조 불가능한 append-only 감사 체인 |
| 기술 | SHA-256 해시 체인 (블록체인 경량 구현), 변조 탐지, JSON Lines 저장 |
| 규제 | CSAP D-06: 감사 로그 최소 1년 보존, 무결성 검증 가능, 수정/삭제 불가 |
| 운영 | 실시간 무결성 검증, 체인 깨짐 자동 감지, Fastify 플러그인 통합 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 공공기관 CSAP 감리에서 감사 로그 변조 방지는 필수 요건 |
| WHO | 감사인 (로그 무결성 검증), 보안 관리자 (변조 탐지), 시스템 (자동 기록) |
| RISK | 로그 변조 시 감리 결함, 해시 계산 성능 병목, 체인 깨짐 복구 |
| SUCCESS | 모든 감사 이벤트 해시 체인에 기록, 변조 탐지 100%, 검증 API 제공 |
| SCOPE | @public-saas/audit-chain 패키지 + Fastify 플러그인 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | 검증 기준 |
|----|---------|---------|----------|
| FR-AC.1 | SHA-256 해시 체인 엔트리 추가 | P0 | 각 엔트리가 이전 해시를 포함하여 체인 형성 |
| FR-AC.2 | 체인 무결성 검증 | P0 | verify()로 전체 체인 변조 여부 확인 |
| FR-AC.3 | 변조 탐지 및 위치 식별 | P0 | 변조된 엔트리의 인덱스와 원인 반환 |
| FR-AC.4 | Append-only 보장 | P1 | 삭제/수정 API 미제공, 추가만 가능 |
| FR-AC.5 | JSON Lines 직렬화 | P1 | 파일 기반 영속화 가능 형식 |
| FR-AC.6 | Fastify 플러그인 통합 | P1 | 플러그인 등록, /audit/verify 엔드포인트 |
| FR-AC.7 | 엔트리 검색/조회 | P2 | 시간 범위, 액터, 액션별 필터 |

## 산출물

| 파일 | 설명 |
|------|------|
| `platform/packages/audit-chain/src/audit-chain.ts` | 핵심 해시 체인 로직 |
| `platform/packages/audit-chain/src/audit-plugin.ts` | Fastify 플러그인 |
| `platform/packages/audit-chain/src/index.ts` | 엔트리포인트 |
| `platform/packages/audit-chain/tests/audit-chain.test.ts` | 체인 테스트 |
| `platform/packages/audit-chain/tests/audit-plugin.test.ts` | 플러그인 테스트 |

## 추적성 매트릭스

| FR | 소스 파일 | 테스트 | CSAP |
|----|----------|--------|------|
| FR-AC.1 | audit-chain.ts | audit-chain.test.ts | D-06 |
| FR-AC.2 | audit-chain.ts | audit-chain.test.ts | D-06 |
| FR-AC.3 | audit-chain.ts | audit-chain.test.ts | D-06 |
| FR-AC.4 | audit-chain.ts | audit-chain.test.ts | D-06 |
| FR-AC.5 | audit-chain.ts | audit-chain.test.ts | D-06 |
| FR-AC.6 | audit-plugin.ts | audit-plugin.test.ts | D-06, D-10 |
| FR-AC.7 | audit-chain.ts | audit-chain.test.ts | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-09 | 초안 작성 | PM Lead |
