# SVC-AI-ADV-R637 Design — AI기반 지식 그래프 자동 강화 v3

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R637.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+개 |
| 범위 | platform/services/ai-service/src/lib/knowledge-graph-enricher-v3.ts |

## 설계 결정
- 클래스 기반 단일 모듈 (KnowledgeGraphEnricherV3)
- 엔티티 Map<id, EntityRecord>, 관계는 인접 리스트 Map<id, Set<id>>
- 확장 점수 = 연결수 / 최대연결수 (0~1 정규화)
- 저연결 후보: threshold 이하 엔티티 반환
- C/S 등급 즉시 throw (N2SF N-05)
- getAuditLog(): shallow copy

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
