# SVC-CACHE-R7 Plan -- Redis 캐싱 전략 + N+1 쿼리 최적화

> Plan SC: FR-CACHE.1~FR-CACHE.6
> CSAP: D-07 가용성, D-08-05 테넌트 격리, D-10 네트워크 보안
> Phase: Round 7

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-09 | 초기 작성 | PM (Claude) |

## Executive Summary

| 관점 | 내용 |
|------|------|
| 사업 | 자주 조회되는 API 응답 캐싱으로 응답 시간 50%+ 개선, DB 부하 감소 |
| 기술 | @public-saas/cache 공유 패키지, tenant-aware 캐싱, TTL 관리 |
| 보안 | CSAP D-08-05 테넌트 격리 캐시 키, D-10 Redis TLS 연결 |
| 품질 | 캐시 히트율 모니터링, 무효화 전략, E2E 검증 |

## Context Anchor

- **WHY**: 서비스 수 증가로 DB 조회 부하 증가, 반복 쿼리 최적화 필요
- **WHO**: 서비스 개발자, 인프라 운영자
- **RISK**: 캐시 불일치로 인한 데이터 정합성 문제
- **SUCCESS**: 캐시 패키지 생성 + 4개 서비스 적용 + 테스트 통과
- **SCOPE**: tenant-service, user-service, catalog-service, menu-service

## 요구사항

| FR ID | 내용 | CSAP |
|-------|------|------|
| FR-CACHE.1 | @public-saas/cache 공유 패키지 생성 (Redis 클라이언트 추상화) | D-07 |
| FR-CACHE.2 | tenant-aware 캐시 키 생성 (테넌트 격리) | D-08-05 |
| FR-CACHE.3 | TTL 기반 자동 만료 + 수동 무효화 API | D-07 |
| FR-CACHE.4 | tenant-service 캐싱 적용 (테넌트 목록/상세) | D-07 |
| FR-CACHE.5 | user-service 캐싱 적용 (사용자 조회) | D-07 |
| FR-CACHE.6 | catalog-service + menu-service 캐싱 적용 | D-07 |

## 기술 설계

### 캐시 키 패턴
```
{service}:{tenantId}:{resource}:{identifier}
예: tenant:global:list:page=1
예: user:t-001:profile:user-123
예: catalog:t-002:services:category=HR
예: menu:t-003:tree:role=ADMIN
```

### TTL 전략
| 데이터 유형 | TTL | 이유 |
|------------|-----|------|
| 테넌트 목록 | 5분 | 변경 빈도 낮음 |
| 사용자 프로필 | 3분 | 변경 빈도 중간 |
| 카탈로그 목록 | 5분 | 변경 빈도 낮음 |
| 메뉴 트리 | 10분 | 변경 빈도 매우 낮음 |

### 무효화 전략
- Write-through: 쓰기 시 해당 키 즉시 삭제
- Pattern delete: 테넌트 변경 시 `{service}:{tenantId}:*` 패턴 삭제
