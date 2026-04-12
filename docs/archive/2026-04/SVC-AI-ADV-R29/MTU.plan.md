# SVC-AI-ADV-R29: Vector Database 고도화 (벡터 DB 매니저)

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead (Opus)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 대용량 공공 문서(법령 전체, 행정규칙) 밀리초 벡터 검색 지원 |
| 기술 | pgvector + Qdrant 하이브리드 벡터 DB 운영, HNSW 인덱스 최적화 |
| 보안 | CSAP D-08 테넌트별 네임스페이스 격리, D-09 벡터 데이터 암호화 |
| 운영 | 온프레미스 Qdrant 클러스터 + pgvector 폴백 이중화 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 기존 pgvector 단독 운영은 100만 건 이상 벡터에서 검색 지연 발생. Qdrant HNSW 인덱스로 밀리초 응답 보장 |
| WHO | AI 서비스 개발자, 검색 기능 사용 공공기관 담당자 |
| RISK | Qdrant 장애 시 pgvector 폴백 미작동, 테넌트 간 벡터 데이터 누출 |
| SUCCESS | 100만 벡터 검색 < 50ms, 테넌트 격리 100%, 장애 시 자동 폴백 |
| SCOPE | 벡터 DB 추상화 계층, Qdrant 클라이언트, 인덱스 최적화, 필터링 검색 |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-ADV29.1 | 벡터 DB 추상화 — pgvector/Qdrant 통합 인터페이스 | P0 |
| FR-ADV29.2 | Qdrant 클라이언트 — 컬렉션 CRUD + HNSW 인덱스 관리 | P0 |
| FR-ADV29.3 | 하이브리드 검색 — 밀집(dense) + 희소(sparse) 벡터 결합 | P0 |
| FR-ADV29.4 | 필터링 검색 — 메타데이터 기반 조건 필터 + 벡터 유사도 결합 | P1 |
| FR-ADV29.5 | 네임스페이스 격리 — 테넌트별 컬렉션/파티션 분리 (CSAP D-08) | P0 |
| FR-ADV29.6 | 자동 폴백 — Qdrant 장애 감지 시 pgvector 자동 전환 | P1 |
| FR-ADV29.7 | 인덱스 최적화 — HNSW 파라미터 자동 튜닝 (ef, m 값) | P2 |
| FR-ADV29.8 | 배치 업서트 — 대량 벡터 일괄 삽입 (청크 단위 트랜잭션) | P1 |

---

## 성공 기준

| SC ID | 기준 | 측정 방법 |
|-------|------|----------|
| SC-1 | 100만 벡터 검색 응답 < 50ms (p95) | 벤치마크 테스트 |
| SC-2 | 테넌트 간 벡터 격리 100% | 격리 검증 테스트 |
| SC-3 | Qdrant 장애 시 pgvector 폴백 < 3초 | 장애 시뮬레이션 |
| SC-4 | FR 전수 구현 (8/8) | 코드 리뷰 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| vector-db-manager.ts | platform/services/ai-service/src/lib/vector-db-manager.ts |
| qdrant-client.ts | platform/services/ai-service/src/lib/qdrant-client.ts |
| Design 문서 | docs/02-design/mtus/SVC-AI-ADV-R29.design.md |

---

## 추적성 매트릭스

| FR ID | Design 섹션 | 구현 파일 | CSAP |
|-------|-----------|----------|------|
| FR-ADV29.1 | §1 | vector-db-manager.ts | - |
| FR-ADV29.2 | §2 | qdrant-client.ts | - |
| FR-ADV29.3 | §3 | vector-db-manager.ts | - |
| FR-ADV29.4 | §4 | vector-db-manager.ts | - |
| FR-ADV29.5 | §5 | vector-db-manager.ts | D-08 |
| FR-ADV29.6 | §6 | vector-db-manager.ts | - |
| FR-ADV29.7 | §7 | qdrant-client.ts | - |
| FR-ADV29.8 | §8 | vector-db-manager.ts | - |
