# SVC-AI-ADV-R54 — Multi-Tenant Embedding Cache

> 2026-04-12 | v1.0.0 | 작성자: PM Lead

## Executive Summary
| 관점 | 목표 |
|---|---|
| 비즈니스 | 임베딩 API 비용 40% 절감, 평균 응답 시간 60% 단축 |
| 기술 | 테넌트 간 공유 가능 캐시 + 테넌트 전용 캐시 분리 |
| 보안 | 테넌트 격리(CSAP D-08), O등급만 공유 캐시 진입 |
| 규정 | CSAP D-08 접근통제, D-06 감사 |

## Context Anchor
- **WHY**: 다수 테넌트가 유사 공공 문서(법령/고시/지침 등)를 조회. 임베딩을 테넌트별로 각각 계산하면 비용·지연이 중복.
- **WHO**: 모든 테넌트, 특히 공공기관 문서 RAG 사용자
- **RISK**: 테넌트 간 정보 노출 → 공유 캐시는 O등급 + 해시 기반 키만 허용
- **SUCCESS**: 캐시 히트율 ≥ 50%, 임베딩 API 호출 40% 감소
- **SCOPE**: LRU 캐시, 테넌트 격리 규칙, 공유/전용 이중 계층, 감사 로그

## FR
| FR | 산출물 |
|---|---|
| FR-R54.1 텍스트 해시 키 생성 | `multi-tenant-embedding-cache.ts::hashKey` |
| FR-R54.2 테넌트 전용 캐시 조회/저장 | `::getPrivate/setPrivate` |
| FR-R54.3 공유 캐시 조회/저장(O등급) | `::getShared/setShared` |
| FR-R54.4 이중 조회(전용→공유) | `::lookup` |
| FR-R54.5 LRU evict (max size) | 내부 구현 |
| FR-R54.6 통계(히트율) 및 감사 로그 | `::getStats/getAuditLog` |

## NFR
- 단일 lookup < 1ms (in-memory)
- TS strict 통과, 테스트 커버리지 80%+

## 추적성
| FR | 산출물 | 테스트 |
|---|---|---|
| FR-R54.1~6 | multi-tenant-embedding-cache.ts | `__tests__/multi-tenant-embedding-cache.test.ts` |

## 변경 이력
| 1.0.0 | 2026-04-12 | 초안 |
