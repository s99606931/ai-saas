# SVC-AI-ADV-R77 — Retrieval Chunk Deduplicator

> 2026-04-12 | v1.0.0 | PM Lead (8차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | 중복 청크 제거로 컨텍스트 품질·토큰 비용 개선 | 토큰 -20% |
| 기술 | 해시 + 의미 유사도 이중 중복 탐지 | dedup p95 < 20ms |
| 보안 | 등급 guard + 원본 추적 | N2SF N-05 |
| 규정 | 중복 탐지 감사 | CSAP D-06 |

## Context Anchor
- **WHY**: 여러 리트리버/소스에서 가져온 청크 중 동일 문장·중복 의미가 LLM 프롬프트에 섞이면 토큰 낭비 + 품질 저하가 발생한다. 정확한 중복 제거가 필요.
- **WHO**: RAG 파이프라인, 컨텍스트 빌더
- **RISK**: 과도한 dedup으로 정보 손실, 의미 유사도 과탐, 성능 저하
- **SUCCESS**: 중복 탐지율 ≥ 95%, 정보 손실 ≤ 2%
- **SCOPE**: IN — 해시 기반 + TF-IDF/자카드 기반 의미 유사도 / OUT — 임베딩 모델, 벡터 DB

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R77.1 | 정규화 + SHA-256 해시 중복 제거 | retrieval-chunk-deduplicator.ts |
| FR-R77.2 | 토큰 Jaccard 기반 의미 중복 탐지 (임계값 기본 0.85) | retrieval-chunk-deduplicator.ts |
| FR-R77.3 | 대표 청크 선정(점수/출처 우선순위) + 병합 리포트 | retrieval-chunk-deduplicator.ts |
| FR-R77.4 | C/S 등급 차단 + 통계(총 입력/중복/유지) | retrieval-chunk-deduplicator.ts |
| FR-R77.5 | getAuditLog + 이벤트 (DEDUP/SEMANTIC_DUP/BLOCKED) | retrieval-chunk-deduplicator.ts |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| FR-R77.1 | retrieval-chunk-deduplicator.ts | retrieval-chunk-deduplicator.test.ts | - |
| FR-R77.2 | retrieval-chunk-deduplicator.ts | retrieval-chunk-deduplicator.test.ts | - |
| FR-R77.3 | retrieval-chunk-deduplicator.ts | retrieval-chunk-deduplicator.test.ts | - |
| FR-R77.4 | retrieval-chunk-deduplicator.ts | retrieval-chunk-deduplicator.test.ts | N-05 |
| FR-R77.5 | retrieval-chunk-deduplicator.ts | retrieval-chunk-deduplicator.test.ts | D-06 |
