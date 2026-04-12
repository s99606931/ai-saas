# MTU Plan — SVC-AI-ADV-R140 Semantic Deduplication Engine

> **원 요청 번호**: R140
> **모듈**: `platform/services/ai-service/src/lib/semantic-deduplication-engine.ts`

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공공기관 민원·공지·문서 중복 제거로 스토리지 비용 30% 절감 |
| 기술 | N-gram 기반 Jaccard + Cosine 유사도 혼합, 클러스터링 후 대표 선택 |
| 보안 | O등급 메타데이터 텍스트만. C/S등급 차단 |
| 규제 | CSAP D-06 감사, 행안부 기록관리 지침 |

## Context Anchor

- WHY: 기존 `alert-dedup-engine`, `retrieval-chunk-deduplicator`는 단순 해시/ID 기반. 의미적 중복 공백
- WHO: 문서관리자, 데이터 운영팀
- RISK: 거짓 중복 처리로 원본 손실
- SUCCESS: 중복 탐지 F1 0.85+
- SCOPE: 유사도 계산 → 클러스터링 → 대표 문서 선택

## FR

| ID | 설명 |
|----|------|
| FR-R140.1 | 텍스트 토크나이즈 + N-gram 생성 |
| FR-R140.2 | Jaccard 유사도 계산 |
| FR-R140.3 | 의미적 중복 클러스터링 (임계값 기반) |
| FR-R140.4 | 대표 문서 선택 (최장/최신) |
| FR-R140.5 | 감사 로그 `getAuditLog()` |
| FR-R140.6 | C/S등급 차단 |
