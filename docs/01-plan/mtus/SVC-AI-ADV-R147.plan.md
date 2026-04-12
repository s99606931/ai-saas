# MTU Plan — SVC-AI-ADV-R147 Knowledge Base Change Syncer

> **원 요청 번호**: R147
> **모듈**: `platform/services/ai-service/src/lib/kb-change-syncer.ts`

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | KB 소스 문서 변경 감지 → 임베딩 재생성 pending 큐 관리 |
| 기술 | 콘텐츠 해시 기반 변경 감지, 상태 전이 관리, 큐잉 |
| 보안 | 문서 원문 아닌 해시만 추적, O등급 확인 |
| 규제 | 문서 관리 규정, CSAP D-12 변경관리 |

## Context Anchor

- WHY: 기존 `knowledge-base-builder`(최초 빌드)와 달리 증분 변경 동기화 책임
- WHO: AI RAG 운영팀, KB 관리자
- RISK: 낡은 임베딩 → 부정확 응답
- SUCCESS: 변경 감지 누락 0건, 재임베딩 누락 0건
- SCOPE: upsert→hash 비교→상태 전이→재임베딩 큐→완료 처리

## FR

| ID | 설명 |
|----|------|
| FR-R147.1 | 문서 upsert: docId, contentHash, updatedAt |
| FR-R147.2 | 해시 차이 감지 → PENDING 상태 |
| FR-R147.3 | pending 문서 조회 (FIFO) |
| FR-R147.4 | 처리 완료 마킹 (EMBEDDED) |
| FR-R147.5 | 삭제 처리 → TOMBSTONE |
| FR-R147.6 | 감사 로그 + C/S 차단 |

## 테스트

- 최초 upsert → PENDING
- 동일 해시 upsert → 상태 유지
- 해시 변경 → PENDING 재진입
- markEmbedded → EMBEDDED
- delete → TOMBSTONE
