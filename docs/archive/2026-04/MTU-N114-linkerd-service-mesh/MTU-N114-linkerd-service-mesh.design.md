# MTU-N114: Linkerd 서비스 메시 완성 — 설계 문서

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/MTU-N114-linkerd-service-mesh.plan.md

## Design Anchor

| 항목 | 내용 |
|------|------|
| 아키텍처 패턴 | Pragmatic Balance — Linkerd SMI + ServerAuthorization + 관측성 |
| 핵심 결정 | SMI TrafficSplit으로 카나리 배포, ServerAuthorization으로 제로트러스트 |
| 제약 | k3s 단일 클러스터, Linkerd 2.x 기 설치 상태 |
| 의존성 | Linkerd (기 설치), Prometheus (기 설치), Grafana (기 설치) |

## 상세 설계

### DS-N114.1: TrafficSplit 카나리 배포

```yaml
# infra/linkerd/traffic-split/api-gateway-canary.yaml
apiVersion: split.smi-spec.io/v1alpha2
kind: TrafficSplit
metadata:
  name: api-gateway-canary
  namespace: saas-system
spec:
  service: api-gateway
  backends:
    - service: api-gateway-stable
      weight: 900
    - service: api-gateway-canary
      weight: 100
```

### DS-N114.2: RetryBudget 및 타임아웃

```yaml
# ServiceProfile에 retryBudget, timeout 추가
spec:
  retryBudget:
    retryRatio: 0.2
    minRetriesPerSecond: 10
    ttl: 120s
  routes:
    - name: "POST /api/auth/login"
      timeout: 5s
      isRetryable: false
```

### DS-N114.3: ServerAuthorization 확장

```yaml
# 서비스별 접근 제어 — 최소 권한 원칙
apiVersion: policy.linkerd.io/v1beta1
kind: ServerAuthorization
metadata:
  name: auth-service-allow-gateway
  namespace: saas-system
spec:
  server:
    name: auth-service
  client:
    meshTLS:
      serviceAccounts:
        - name: api-gateway
```

### DS-N114.4: mTLS 검증

```bash
# linkerd viz stat로 전체 mTLS 적용 확인
linkerd viz stat deploy -n saas-system --from deploy/api-gateway
# TLS 컬럼 100% 확인
```

### DS-N114.5: 대시보드 설계

패널 목록:
- 서비스 메시 토폴로지 맵
- 서비스별 성공률 (success rate)
- P50/P95/P99 지연시간
- 초당 요청률 (RPS)
- TCP 연결 상태 (mTLS 비율)
- TrafficSplit 가중치 현황
