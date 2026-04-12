# MTU-N99: Crossplane IaC -- Design

> **MTU ID**: MTU-N99
> **Plan 참조**: docs/01-plan/mtus/MTU-N99-crossplane-iac.plan.md
> **작성일**: 2026-04-10

---

## Design Anchor

| 항목 | 내용 |
|------|------|
| 목표 | Kubernetes 네이티브 IaC로 인프라 추상화 + 셀프서비스 |
| 제약 | 외부 클라우드 금지, Provider-Kubernetes만 사용 |
| 검증 | XRD -> Composition -> Claim 전체 흐름 검증 |

## 아키텍처

```
[개발자 Claim] --> [Crossplane XRD]
                        |
                  [Composition]
                   /    |    \
           [Namespace] [CNPG] [ConfigMap]
           [NetworkPolicy] [ResourceQuota]
```

### XRD 정의

| XRD | 설명 | Composition 리소스 |
|-----|------|-------------------|
| XDatabase | PostgreSQL 데이터베이스 | CNPG Cluster, Secret, NetworkPolicy |
| XCache | Redis 캐시 인스턴스 | Deployment, Service, ConfigMap |
| XNamespace | 테넌트 네임스페이스 | Namespace, ResourceQuota, LimitRange, NetworkPolicy |

### N2SF 등급별 Composition 변형

| 등급 | 암호화 | 격리 | 백업 |
|------|--------|------|------|
| C | AES-256 필수 | 전용 노드 | 실시간 |
| S | AES-256 필수 | NetworkPolicy 격리 | 1시간 |
| O | 선택적 | 논리적 분리 | 일일 |

## 산출물

| # | 파일 | 설명 |
|---|------|------|
| 1 | infra/crossplane/install.yaml | Crossplane Helm values |
| 2 | infra/crossplane/provider-kubernetes.yaml | Provider 설정 |
| 3 | infra/crossplane/xrd/xdatabase.yaml | DB XRD |
| 4 | infra/crossplane/xrd/xcache.yaml | 캐시 XRD |
| 5 | infra/crossplane/xrd/xnamespace.yaml | 네임스페이스 XRD |
| 6 | infra/crossplane/compositions/ | Composition 5개 |
| 7 | infra/crossplane/claims/ | Claim 예제 |
| 8 | tests/e2e/test-crossplane.sh | E2E 테스트 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 설계 | PM Agent |
