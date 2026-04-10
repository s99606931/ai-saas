# Design: SVC-OTEL-R3 -- OpenTelemetry 분산 추적 확산

> 작성일: 2026-04-09 | 버전: 1.0 | 작성자: PM Lead
> Plan: docs/01-plan/mtus/SVC-OTEL-R3.plan.md

---

## Executive Summary

| 관점 | 설계 결정 |
|------|----------|
| 비즈니스 | 단일 공유 패키지로 17개 서비스 일관된 관측성 확보 |
| 기술 | @public-saas/observability 패키지 + Fastify 플러그인 패턴 |
| 보안 | OTel 데이터에 PII 미포함 (서비스명/트레이스ID/지연시간만) |
| 운영 | OTEL_ENABLED 환경 변수로 on/off 제어, 무중단 배포 |

## Design Anchor

- **WHY**: auth-service에 하드코딩된 OTel 설정을 공유 패키지로 추출하여 15개 서비스에 확산
- **결정**: Pragmatic Balance -- 공유 패키지 생성 + 최소 침습적 서비스 통합
- **대안 검토**:
  - Option A: 각 서비스에 telemetry.ts 복사 -> 유지보수 지옥, 기각
  - Option B: 공유 패키지 생성 -> 채택 (단일 변경점, 일관성)
  - Option C: Sidecar 패턴 -> 오버 엔지니어링, 기각

---

## 아키텍처 설계

### 1. 공유 패키지 구조

```
platform/packages/observability/
  src/
    index.ts           -- initTelemetry(), shutdownTelemetry() 내보내기
    telemetry.ts       -- OTel SDK 초기화 핵심 로직
    response-time.ts   -- X-Response-Time Fastify 플러그인
  tests/
    telemetry.test.ts
    response-time.test.ts
  package.json
  tsconfig.json
```

### 2. initTelemetry(config) 인터페이스

```typescript
interface TelemetryConfig {
  serviceName: string;    // 예: 'user-service'
  serviceVersion: string; // 예: '0.1.0'
}

// 서비스 진입점에서 호출
initTelemetry({ serviceName: 'user-service', serviceVersion: '0.1.0' });
```

### 3. 서비스 통합 패턴

```typescript
// index.ts (각 서비스)
import { initTelemetry, shutdownTelemetry } from '@public-saas/observability';

initTelemetry({ serviceName: 'user-service', serviceVersion: '0.1.0' });

import Fastify from 'fastify';
// ... 나머지 import

// shutdown에 추가:
await shutdownTelemetry();
```

### 4. X-Response-Time 플러그인

```typescript
// Fastify onRequest + onResponse 훅 사용
// onRequest: 시작 시간 기록
// onResponse: X-Response-Time 헤더에 경과 시간 (ms) 추가
```

### 5. 서비스별 포트 매핑 (기존 유지)

| 서비스 | 포트 | OTel service.name |
|--------|------|-------------------|
| api-gateway | 3000 | api-gateway |
| auth-service | 3001 | auth-service |
| user-service | 3002 | user-service |
| tenant-service | 3003 | tenant-service |
| ai-service | 3004 | ai-service |
| audit-service | 3005 | audit-service |
| menu-service | 3006 | menu-service |
| catalog-service | 3007 | catalog-service |
| subscription-service | 3008 | subscription-service |
| billing-service | 3009 | billing-service |
| crm-service | 3010 | crm-service |
| notification-service | 3011 | notification-service |
| file-service | 3012 | file-service |
| compliance-service | 3013 | compliance-service |
| security-service | 3014 | security-service |
| security-monitor-service | 3015 | security-monitor-service |
| saas-catalog-service | 3016 | saas-catalog-service |

---

## Session Guide

### S1: 공유 패키지 생성
1. platform/packages/observability/ 디렉토리 구조 생성
2. package.json (workspace 연동)
3. src/telemetry.ts -- auth-service 패턴 기반 일반화
4. src/response-time.ts -- Fastify 플러그인
5. src/index.ts -- 공개 API 내보내기

### S2: 15개 서비스 통합
1. 각 서비스 package.json에 의존성 추가
2. 각 서비스 index.ts에 initTelemetry/shutdownTelemetry 추가

### S3: 테스트
1. 공유 패키지 유닛 테스트
2. 각 서비스 OTel 통합 테스트

---

## CSAP 준수 확인

- D-06: OTel 트레이스 ID = 감사 추적 식별자로 활용 가능
- D-07: shutdownTelemetry()로 graceful shutdown 보장
- N2SF: OTel 데이터는 O등급 (서비스 메타데이터만 포함, PII 없음)
