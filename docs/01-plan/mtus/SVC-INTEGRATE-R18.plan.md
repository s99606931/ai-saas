# SVC-INTEGRATE-R18: R13~R17 패키지 17개 서비스 실제 통합

> **MTU ID**: SVC-INTEGRATE-R18
> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **작성자**: PM Lead
> **상태**: Plan 완료

---

## Executive Summary (4관점 테이블)

| 관점 | 항목 | 상세 |
|------|------|------|
| 비즈니스 | 서비스 운영 안정성 | mesh-ready로 graceful shutdown 표준화, 무중단 배포 보장 |
| 기술 | 크로스커팅 패키지 통합 | 4개 패키지(mesh-ready, tenant-isolation, config-vault, event-bus) 전 서비스 적용 |
| 보안/규제 | CSAP D-07/D-08/D-09/D-10 | 그레이스풀 셧다운, 테넌트 격리, 암호화, 분산 추적 |
| 운영 | 관찰가능성 향상 | 이벤트 기반 서비스 간 통신 + 트레이스 전파 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | R13~R17에서 구현한 4개 크로스커팅 패키지가 서비스에 미적용 상태. 서비스별 수동 shutdown, 직접 env 참조, 테넌트 격리 미적용. |
| WHO | 플랫폼 운영팀, 개발팀, 보안감사관 |
| RISK | 서비스 재시작 시 요청 유실(mesh-ready 미적용), 테넌트 간 데이터 누출(RLS 미적용), 설정 분산 관리로 일관성 부재 |
| SUCCESS | 17개 서비스 전체에 4개 패키지 통합 + 테스트 통과 |
| SCOPE | platform/services/* 17개 서비스 index.ts 수정 |

---

## 기능 요구사항

### FR-R18.1: mesh-ready 플러그인 전 서비스 적용
- 17개 서비스에 `meshReadyPlugin` 등록
- 기존 수동 SIGTERM/SIGINT 핸들러 → meshReadyPlugin의 GracefulShutdown으로 대체
- 분산 추적 헤더(W3C traceparent + B3) 자동 전파
- `/metadata` 엔드포인트 자동 등록

### FR-R18.2: tenant-isolation 플러그인 데이터 서비스 적용
- 대상: user-service, tenant-service, billing-service, crm-service (데이터 조회 서비스 4개)
- `tenantIsolationPlugin` 등록 (X-Tenant-Id 헤더 기반 RLS)
- `/tenant/isolation-check` 검증 엔드포인트 자동 등록

### FR-R18.3: config-vault 플러그인 전 서비스 적용
- 17개 서비스에 `configPlugin` 등록
- 직접 `process.env` 참조 → `app.config.get()` 으로 교체
- 서비스별 환경변수 매핑 정의
- 시크릿 참조 자동 해석

### FR-R18.4: event-bus 플러그인 핵심 서비스 적용
- 대상: user-service, audit-service, auth-service, notification-service, security-service (이벤트 발행/구독 서비스 5개)
- `eventBusPlugin` 등록
- 크로스 서비스 이벤트 패턴 정의:
  - `user.created` → audit-service, notification-service
  - `auth.login_failed` → security-service
  - `tenant.created` → audit-service

### FR-R18.5: 기존 수동 shutdown 코드 제거
- `process.on('SIGTERM')` / `process.on('SIGINT')` 수동 핸들러 제거
- `process.on('uncaughtException')` / `process.on('unhandledRejection')` 유지 (안전망)
- meshReadyPlugin이 shutdown + trace 전파를 통합 관리

---

## 비기능 요구사항

| ID | 항목 | 기준 |
|----|------|------|
| NFR-R18.1 | 셧다운 지연 | 30초 이내 (k8s terminationGracePeriodSeconds) |
| NFR-R18.2 | 테넌트 격리 | RLS 100% (크로스 테넌트 쿼리 불가) |
| NFR-R18.3 | 설정 일관성 | 모든 서비스 configPlugin 통해 설정 로드 |
| NFR-R18.4 | 이벤트 전달 보장 | 데드레터 큐로 실패 이벤트 보존 |

---

## CSAP 매핑

| CSAP 항목 | FR ID | 설명 |
|-----------|-------|------|
| D-07 가용성 | FR-R18.1 | GracefulShutdown 표준화 |
| D-08 접근 통제 | FR-R18.2 | 테넌트 RLS 강제 적용 |
| D-09 암호화 | FR-R18.2 | 테넌트별 AES-256-GCM |
| D-10 네트워크 보안 | FR-R18.1 | W3C TraceContext 분산 추적 |
| D-06 침해사고 관리 | FR-R18.4 | 이벤트 기반 감사 로그 연동 |

---

## 구현 전략

### 서비스별 적용 매트릭스

| 서비스 | mesh-ready | tenant-isolation | config-vault | event-bus |
|--------|-----------|-----------------|-------------|-----------|
| auth-service | O | - | O | O |
| user-service | O | O | O | O |
| tenant-service | O | O | O | - |
| api-gateway | O | - | O | - |
| ai-service | O | - | O | - |
| audit-service | O | - | O | O |
| menu-service | O | - | O | - |
| catalog-service | O | - | O | - |
| subscription-service | O | - | O | - |
| billing-service | O | O | O | - |
| crm-service | O | O | O | - |
| notification-service | O | - | O | O |
| file-service | O | - | O | - |
| compliance-service | O | - | O | - |
| security-service | O | - | O | - |
| security-monitor-service | O | - | O | - |
| saas-catalog-service | O | - | O | - |

### 변경 패턴 (표준 템플릿)

```typescript
// 추가 import
import { meshReadyPlugin } from '@public-saas/mesh-ready';
import { configPlugin } from '@public-saas/config-vault';
// 해당 서비스만: import { tenantIsolationPlugin } from '@public-saas/tenant-isolation';
// 해당 서비스만: import { eventBusPlugin } from '@public-saas/event-bus';

// 플러그인 등록 (app 생성 직후)
await app.register(meshReadyPlugin, {
  service: { name: '{서비스명}', version: '{버전}' },
});
await app.register(configPlugin, { envPrefix: '{PREFIX}' });

// 기존 수동 shutdown 코드 제거
// meshReadyPlugin이 SIGTERM/SIGINT 자동 처리
```

---

## 산출물

| 산출물 | 경로 | 상태 |
|--------|------|------|
| Plan 문서 | docs/01-plan/mtus/SVC-INTEGRATE-R18.plan.md | 완료 |
| 서비스 코드 변경 | platform/services/*/src/index.ts (17개) | 구현 예정 |
| 테스트 | platform/services/*/tests/ (통합 테스트) | 구현 예정 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
