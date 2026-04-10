# MTU-N159: 토폴로지 인식 라우팅 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead  
> **Plan 참조**: `docs/01-plan/mtus/MTU-N159-topology-aware-routing.plan.md`

---

## 1. Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 패턴 | Pragmatic Balance — Kubernetes 네이티브 TAR + Linkerd 존 라우팅 통합 |
| 핵심 기술 | Kubernetes TopologyAwareHints (v1.27+), Linkerd ServiceProfile, Prometheus |
| 데이터 흐름 | Client Pod → kube-proxy (TAR 힌트) → 동일 존 EndpointSlice → 대상 Pod |
| 페일오버 전략 | 존 내 가용 엔드포인트 < 임계값 시 크로스존 허용 |
| 보안 | Linkerd mTLS 유지, N2SF 네트워크 격리 영역 준수 |

---

## 2. 아키텍처 옵션 분석

### 옵션 A: Kubernetes 네이티브 TAR만 사용 (경량)
- 장점: 추가 컴포넌트 불필요, kube-proxy 기반
- 단점: L4 수준만 지원, 세밀한 라우팅 불가
- 위험: 엔드포인트 불균형 시 힌트 비활성화

### 옵션 B: Linkerd 토폴로지 라우팅만 사용
- 장점: L7 수준 지능형 라우팅, 재시도/타임아웃 통합
- 단점: Linkerd 프록시 의존성, 리소스 오버헤드
- 위험: Linkerd 미주입 서비스 제외

### 옵션 C: Kubernetes TAR + Linkerd 연동 (Pragmatic Balance) [선택]
- 장점: L4/L7 이중 보호, 네이티브 지원 + 서비스 메시 고급 기능
- 단점: 설정 복잡도 증가
- 위험: 관리 포인트 2곳
- 선택 이유: 공공기관 환경에서 이중 보호 필수, 기존 Linkerd 인프라 재활용

---

## 3. 상세 설계

### 3.1 토폴로지 존 레이블 체계

```yaml
# 노드 레이블 체계 (k3s 단일 클러스터 + WSL2)
# topology.kubernetes.io/zone: zone-{a|b|c}
# topology.kubernetes.io/region: kr-central
# 단일 노드 환경에서는 zone-a 기본 할당
```

존 할당 전략:
- WSL2 단일 노드: `zone-a` 기본 (개발 환경)
- 멀티 노드: 노드별 순환 할당 (`zone-a`, `zone-b`, `zone-c`)
- 워커 노드 3대 이상 시 TAR 자동 활성화

### 3.2 TAR 서비스 패치

```yaml
# 모든 SaaS 서비스에 topology-mode 어노테이션 추가
apiVersion: v1
kind: Service
metadata:
  annotations:
    service.kubernetes.io/topology-mode: Auto
```

적용 대상 서비스:
- auth-service, user-service, tenant-service
- api-gateway, catalog-service, billing-service
- audit-service, compliance-service, security-service
- notification-service, file-service

### 3.3 Linkerd 존 인식 라우팅

```yaml
# Linkerd 서비스 프로파일에 존 친화성 설정
apiVersion: linkerd.io/v1alpha2
kind: ServiceProfile
metadata:
  name: auth-service.public-saas.svc.cluster.local
spec:
  routes:
    - name: default
      condition:
        pathRegex: /.*
      responseClasses:
        - condition:
            status:
              min: 200
              max: 299
          isFailure: false
```

### 3.4 페일오버 정책

| 조건 | 동작 |
|------|------|
| 존 내 가용 엔드포인트 >= 2 | 존 내부 전용 라우팅 |
| 존 내 가용 엔드포인트 == 1 | 존 내부 + 경고 알림 |
| 존 내 가용 엔드포인트 == 0 | 크로스존 페일오버 + 긴급 알림 |

### 3.5 모니터링 메트릭

| 메트릭 | 설명 | 임계값 |
|--------|------|--------|
| `topology_routing_same_zone_ratio` | 동일 존 라우팅 비율 | >= 0.90 |
| `topology_routing_cross_zone_total` | 크로스존 트래픽 총량 | 알림용 |
| `topology_routing_failover_count` | 페일오버 발생 횟수 | > 5/h 시 경고 |
| `topology_routing_endpoint_balance` | 존별 엔드포인트 균형도 | < 0.3 시 경고 |

---

## 4. CSAP/N2SF 매핑

| 통제항목 | 구현 내용 |
|----------|---------|
| D-08 접근통제 | 토폴로지 기반 네트워크 격리, 존 내부 트래픽 우선 |
| D-09 암호화 | Linkerd mTLS 유지, 크로스존 포함 전구간 암호화 |
| D-06 침해사고관리 | 크로스존 트래픽 감사 로그, 페일오버 이벤트 기록 |
| N2SF N-03 | 보안 등급별 네트워크 존 분리 연동 |

---

## 5. Session Guide

```
구현 순서:
1. setup-topology-labels.sh → 노드 레이블 설정
2. tar-service-patch.yaml → 서비스 어노테이션 패치
3. linkerd-zone-routing.yaml → Linkerd 존 라우팅 설정
4. failover-policy.yaml → 페일오버 정책
5. prometheus-rules.yaml → 모니터링 규칙
6. grafana-dashboard.json → 대시보드
7. RUNBOOK.md → 운영 가이드
8. verify-topology-routing.sh → 검증
```

---

## 6. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 설계 | PM Lead |
