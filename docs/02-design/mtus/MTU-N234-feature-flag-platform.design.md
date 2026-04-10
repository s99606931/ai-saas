# MTU-N234: Feature Flag 자체 호스팅 플랫폼 — Design

> **버전**: 1.0 | **작성일**: 2026-04-10 | **작성자**: CTO Lead
> **Plan 참조**: docs/01-plan/mtus/MTU-N234-feature-flag-platform.plan.md

## 아키텍처 옵션 분석

| 옵션 | 장점 | 단점 | 선택 |
|------|------|------|------|
| A. Unleash OSS | 성숙도 높음, PostgreSQL 백엔드, Edge 지원 | Java 기반 무거움 | **선택** |
| B. Flipt | Go 단일 바이너리, 경량 | 생태계 작음, SDK 제한 | - |
| C. GrowthBook | A/B 테스트 통합 | 설정 복잡 | - |

**선택 근거**: Unleash는 가장 성숙한 OSS Feature Flag 플랫폼. PostgreSQL 백엔드로 CloudNativePG와 통합 가능. Edge/Proxy를 통한 프론트엔드 SDK 지원이 우수.

## 상세 설계

### 1. 컴포넌트 아키텍처

```
[클라이언트 앱] → [Unleash Edge] → [Unleash Server] → [PostgreSQL]
                      ↓
               [Prometheus /metrics]
                      ↓
               [Grafana Dashboard]
```

### 2. Helm Chart 설계 (FR-FF.1)

```yaml
# values.yaml 핵심 설정
unleash:
  replicaCount: 2
  image:
    repository: unleashorg/unleash-server
    tag: "6.4"
  resources:
    requests: { cpu: 200m, memory: 256Mi }
    limits: { cpu: 500m, memory: 512Mi }
  env:
    DATABASE_HOST: unleash-pg-rw.feature-flags.svc
    DATABASE_NAME: unleash
    DATABASE_SSL: "true"
  serviceMonitor:
    enabled: true
```

### 3. Edge 배포 (FR-FF.2)

```yaml
unleash-edge:
  replicaCount: 2
  image:
    repository: unleashorg/unleash-edge
    tag: "19.5"
  args: ["edge", "--upstream-url=http://unleash-server:4242"]
  resources:
    requests: { cpu: 100m, memory: 128Mi }
    limits: { cpu: 200m, memory: 256Mi }
```

### 4. SDK 연동 패턴 (FR-FF.3)

```typescript
// packages/feature-flag-sdk/src/index.ts
import { startUnleash, Unleash } from 'unleash-client';

export async function initFeatureFlags(): Promise<Unleash> {
  const unleash = await startUnleash({
    url: process.env.UNLEASH_API_URL || 'http://unleash-edge:3063/api',
    appName: process.env.APP_NAME || 'saas-platform',
    customHeaders: {
      Authorization: process.env.UNLEASH_API_KEY,  // Sealed Secret
    },
    refreshInterval: 15000,  // 15초 갱신
  });
  return unleash;
}

export function isEnabled(unleash: Unleash, flag: string, context?: object): boolean {
  return unleash.isEnabled(flag, context);
}
```

### 5. 감사 로그 연동 (FR-FF.6)

Unleash Webhook → 내부 감사 수집기로 플래그 변경 이벤트 전달.

### 6. 보안 설계

- API 키: SealedSecret으로 암호화 저장
- NetworkPolicy: feature-flags 네임스페이스 격리
- RBAC: Unleash 내부 역할 (Admin, Editor, Viewer)

## Session Guide

1. Helm Chart 작성 (Unleash Server + Edge)
2. SDK 패키지 작성
3. 모니터링 대시보드 작성
4. 테스트 스크립트 작성
5. 검증 실행
