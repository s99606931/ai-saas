# SVC-INTEGRATE-R11 Plan -- 신규 패키지 서비스 통합 적용

> Round 11: cache, rbac, api-version, health 패키지를 실제 서비스에 통합
> 버전: 1.0.0 | 작성일: 2026-04-09 | 작성자: PM Lead

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | Round 7~10에서 구축한 4개 공유 패키지를 17개 서비스에 실전 적용하여 운영 준비도 확보 |
| 기술 | cachePlugin, rbacPlugin, versionPlugin, healthPlugin을 Fastify 서비스에 통합 |
| 보안 | CSAP D-07 가용성(health), D-08 접근통제(rbac), D-12 API 관리(version) 실제 적용 |
| 운영 | /health, /ready 표준화로 k8s 프로브 일관성 확보, 캐시로 응답 성능 향상 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 패키지가 독립적으로 존재하지만 서비스에 통합되지 않아 실효성 없음 |
| WHO | 마이크로서비스 운영팀, k8s 클러스터 관리자, API 소비자 |
| RISK | 플러그인 등록 순서 충돌, 기존 /health 엔드포인트와 중복, 테스트 회귀 |
| SUCCESS | 17개 서비스 healthPlugin 100%, 4개 서비스 cachePlugin, 게이트웨이 rbac+version |
| SCOPE | 서비스 index.ts 수정, package.json 의존성 추가, 통합 테스트 작성 |

## 기능 요구사항

### FR-INT.1: healthPlugin 전 서비스 적용

**대상**: 17개 전체 서비스
**작업**:
- 기존 수동 /health, /ready 엔드포인트 제거
- `@public-saas/health` healthPlugin 등록
- DB 의존성 있는 서비스: CommonCheckers.database() 등록
- Redis 의존성 있는 서비스(auth-service): 커스텀 Redis 체커 등록
- HTTP 의존성 있는 서비스(api-gateway): CommonCheckers.httpService() 등록

**서비스별 의존성 체커**:

| 서비스 | DB | Redis | HTTP 외부 |
|--------|:--:|:-----:|:---------:|
| tenant-service | O | - | - |
| user-service | O | - | - |
| auth-service | O | O | - |
| api-gateway | - | - | O (하위 서비스) |
| catalog-service | O | - | - |
| menu-service | O | - | - |
| billing-service | O | - | - |
| subscription-service | O | - | - |
| crm-service | O | - | - |
| ai-service | O | - | - |
| audit-service | O | - | - |
| file-service | O | - | - |
| notification-service | O | - | - |
| compliance-service | O | - | - |
| security-service | O | - | - |
| security-monitor-service | - | - | O (audit-service) |
| saas-catalog-service | O | - | - |

### FR-INT.2: cachePlugin 적용 (읽기 빈도 높은 서비스)

**대상**: tenant-service, user-service, catalog-service, menu-service
**작업**:
- `@public-saas/cache` cachePlugin 등록
- GET 라우트에 createCacheMiddleware 적용
- TTL 설정: tenant 300초, user 120초, catalog 600초, menu 600초
- 캐시 무효화: CUD(Create/Update/Delete) 작업 후 관련 캐시 삭제
- X-Cache 헤더 응답 확인

### FR-INT.3: rbacPlugin 적용 (게이트웨이 + 인증 서비스)

**대상**: api-gateway, auth-service
**작업**:
- `@public-saas/rbac` rbacPlugin 등록
- api-gateway: 프록시 라우트에 requirePermission 미들웨어 추가
- auth-service: 관리 API에 requirePermission 적용
- 감사 로그 연동 (CSAP D-06)

### FR-INT.4: versionPlugin 적용 (게이트웨이)

**대상**: api-gateway
**작업**:
- `@public-saas/api-version` versionPlugin 등록
- v1 = active, v2 = active 초기 설정
- /api/versions 엔드포인트 노출
- Deprecated 헤더 자동 설정 검증

### FR-INT.5: package.json 의존성 업데이트

모든 대상 서비스의 package.json에 해당 패키지 의존성 추가:
- `"@public-saas/health": "workspace:*"` -- 17개 전체
- `"@public-saas/cache": "workspace:*"` -- 4개 서비스
- `"@public-saas/rbac": "workspace:*"` -- 2개 서비스
- `"@public-saas/api-version": "workspace:*"` -- 1개 서비스

### FR-INT.6: 통합 테스트 작성

**테스트 항목**:
1. healthPlugin 통합: /health 200 OK, /ready 200 OK, /health/detail 정상 응답
2. cachePlugin 통합: GET 요청 X-Cache: MISS -> 재요청 X-Cache: HIT
3. rbacPlugin 통합: 권한 없는 요청 403, 권한 있는 요청 200
4. versionPlugin 통합: /api/versions 응답, deprecated 헤더 확인

## 추적성 매트릭스

| FR ID | 패키지 | 대상 서비스 | CSAP | 테스트 |
|-------|--------|------------|------|--------|
| FR-INT.1 | health | 17개 전체 | D-07 | T-INT.1 |
| FR-INT.2 | cache | 4개 서비스 | D-07 | T-INT.2 |
| FR-INT.3 | rbac | 2개 서비스 | D-08 | T-INT.3 |
| FR-INT.4 | api-version | api-gateway | D-12 | T-INT.4 |
| FR-INT.5 | - | 전체 | - | T-INT.5 |
| FR-INT.6 | - | 전체 | - | T-INT.1~5 |

## 구현 순서

1. package.json 의존성 추가 (FR-INT.5)
2. healthPlugin 전 서비스 적용 (FR-INT.1) -- 가장 범위 넓음, 먼저 완료
3. cachePlugin 4개 서비스 적용 (FR-INT.2)
4. rbacPlugin 2개 서비스 적용 (FR-INT.3)
5. versionPlugin api-gateway 적용 (FR-INT.4)
6. 통합 테스트 작성 및 실행 (FR-INT.6)

## 검증 기준

- 17개 서비스 모두 healthPlugin 등록, /health + /ready 정상 응답
- 4개 서비스 cachePlugin GET 라우트 캐시 동작 확인
- api-gateway rbacPlugin + versionPlugin 정상 동작
- 신규 통합 테스트 전체 PASS
- 기존 테스트 회귀 0건

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 초안 작성 | PM Lead |
