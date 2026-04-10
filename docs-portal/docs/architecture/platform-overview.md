---
title: 플랫폼 아키텍처 개요
description: 공공기관 SaaS 프레임워크 인프라 아키텍처 (자동 생성)
---

# 플랫폼 아키텍처 개요

> 이 문서는 `scripts/generate-arch-diagram.sh`에 의해 자동 생성됩니다.
> 인프라 변경 시 CI 파이프라인에서 자동 업데이트됩니다.

## 시스템 컨텍스트 다이어그램

```mermaid
graph TB
    subgraph "공공기관 SaaS 프레임워크"
        subgraph "보안 계층 (Security)"
            style 보안 계층 fill:#ffcccc
            FALCO[falco]
            KYVERNO[kyverno]
            COSIGN[cosign]
            SEALED_SECRETS[sealed-secrets]
            TRIVY_OPERATOR[trivy-operator]
            SECURITY[security]
            GATEKEEPER[gatekeeper]
            VAULT[vault]
        end

        subgraph "모니터링 계층 (Observability)"
            style 모니터링 계층 fill:#cce5ff
            MONITORING[monitoring]
            SLO[slo]
            PYROSCOPE[pyroscope]
            ANOMALY_DETECTION[anomaly-detection]
            THANOS[thanos]
            FINOPS[finops]
        end

        subgraph "CI/CD 계층 (Delivery)"
            style CI/CD 계층 fill:#ccffcc
            CICD[cicd]
            FLUX[flux]
            FLAGGER[flagger]
            HARBOR[harbor]
            GITEA[gitea]
            RENOVATE[renovate]
            ARGO_ROLLOUTS[argo-rollouts]
            BACKSTAGE[backstage]
        end

        subgraph "네트워크 계층 (Network)"
            NETWORK_POLICIES[network-policies]
            GATEWAY_API[gateway-api]
            LINKERD[linkerd]
            CILIUM[cilium]
        end

        subgraph "스토리지/DR 계층 (Storage)"
            STORAGE[storage]
            VELERO[velero]
            CLOUDNATIVE_PG[cloudnative-pg]
            EXTERNAL_SECRETS[external-secrets]
            DR[dr]
        end

        subgraph "플랫폼 계층 (Platform)"
            HELM[helm]
            KEDA[keda]
            VPA[vpa]
            RESOURCE_MANAGEMENT[resource-management]
            VCLUSTER[vcluster]
            CROSSPLANE[crossplane]
            CERT_MANAGER[cert-manager]
            CHAOS[chaos]
            COMPLIANCE[compliance]
            PREDICTIVE_SCALING[predictive-scaling]
            MULTI_TENANT_CICD[multi-tenant-cicd]
            SONARQUBE[sonarqube]
        end
    end
```

## 컴포넌트 목록

| 계층 | 컴포넌트 | 설명 |
|------|---------|------|
| 모니터링 | anomaly-detection | infra/anomaly-detection |
| CI/CD | argo-rollouts | infra/argo-rollouts |
| CI/CD | backstage | infra/backstage |
| 플랫폼 | cert-manager | infra/cert-manager |
| 플랫폼 | chaos | infra/chaos |
| CI/CD | cicd | infra/cicd |
| 네트워크 | cilium | infra/cilium |
| 스토리지/DR | cloudnative-pg | infra/cloudnative-pg |
| 플랫폼 | compliance | infra/compliance |
| 보안 | cosign | infra/cosign |
| 플랫폼 | crossplane | infra/crossplane |
| 스토리지/DR | dr | infra/dr |
| 스토리지/DR | external-secrets | infra/external-secrets |
| 보안 | falco | infra/falco |
| 모니터링 | finops | infra/finops |
| CI/CD | flagger | infra/flagger |
| CI/CD | flux | infra/flux |
| 보안 | gatekeeper | infra/gatekeeper |
| 네트워크 | gateway-api | infra/gateway-api |
| CI/CD | gitea | infra/gitea |
| CI/CD | harbor | infra/harbor |
| 플랫폼 | helm | infra/helm |
| 플랫폼 | keda | infra/keda |
| 보안 | kyverno | infra/kyverno |
| 네트워크 | linkerd | infra/linkerd |
| 모니터링 | monitoring | infra/monitoring |
| 플랫폼 | multi-tenant-cicd | infra/multi-tenant-cicd |
| 네트워크 | network-policies | infra/network-policies |
| 플랫폼 | predictive-scaling | infra/predictive-scaling |
| 모니터링 | pyroscope | infra/pyroscope |
| CI/CD | renovate | infra/renovate |
| 플랫폼 | resource-management | infra/resource-management |
| 보안 | sealed-secrets | infra/sealed-secrets |
| 보안 | security | infra/security |
| 모니터링 | slo | infra/slo |
| 플랫폼 | sonarqube | infra/sonarqube |
| 스토리지/DR | storage | infra/storage |
| 모니터링 | thanos | infra/thanos |
| 보안 | trivy-operator | infra/trivy-operator |
| 보안 | vault | infra/vault |
| 플랫폼 | vcluster | infra/vcluster |
| 스토리지/DR | velero | infra/velero |
| 플랫폼 | vpa | infra/vpa |

---

> **자동 생성 정보**
> - 생성 시각: 2026-04-10T09:07:47Z
> - 스캔 대상: /data/ai-saas/infra
> - 컴포넌트 수: 43
> - 생성 스크립트: scripts/generate-arch-diagram.sh
