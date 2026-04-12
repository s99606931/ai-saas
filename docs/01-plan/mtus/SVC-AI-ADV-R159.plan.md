# MTU Plan — SVC-AI-ADV-R159 Semantic Embedding Cache

> **원 요청 번호**: R159
> **모듈**: `platform/services/ai-service/src/lib/semantic-embedding-cache.ts`

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 유사 쿼리 재사용으로 AI 호출 비용 50%+ 절감 |
| 기술 | 코사인 유사도 임계값 기반 캐시 조회, LRU 만료 |
| 보안 | 테넌트 격리, C/S 차단, 감사 로그 |
| 규제 | CSAP D-06 감사, N2SF O등급 데이터만 캐시 |

## Context Anchor

- WHY: 동일 의미 쿼리를 매번 LLM에 보내면 비용/지연 누적
- WHO: AI 서비스 백엔드, 비용 관리자
- RISK: 테넌트 간 캐시 혼재 시 정보 유출
- SUCCESS: 유사도 0.92+ 시 캐시 히트, 히트율 측정 가능
- SCOPE: set(tenant, embedding, value), get(tenant, embedding)

## FR

| ID | 설명 |
|----|------|
| FR-R159.1 | CacheEntry: { embedding: number[], value: unknown, createdAt: number } |
| FR-R159.2 | set(tenantId, embedding, value, grade): 테넌트별 저장 |
| FR-R159.3 | get(tenantId, embedding, threshold=0.92): 유사도 최고 항목 반환, 없으면 null |
| FR-R159.4 | 코사인 유사도 계산 (벡터 길이 일치 필수) |
| FR-R159.5 | maxEntries 초과 시 LRU 제거 |
| FR-R159.6 | TTL: 기본 1시간, 만료 시 자동 제거 |
| FR-R159.7 | C/S 등급 차단 |
| FR-R159.8 | getStats(): { hits, misses, size }, getAuditLog() |

## 테스트 케이스

- 동일 임베딩 → hit
- 유사도 < threshold → miss
- 벡터 길이 불일치 → vector_length_mismatch
- LRU: maxEntries 초과 시 가장 오래된 제거
- TTL 만료 후 → miss
- 테넌트 A의 데이터는 B에서 조회 불가
- C/S 차단
- 통계 hits/misses 카운트
