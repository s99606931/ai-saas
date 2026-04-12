# MTU-N108: 멀티테넌트 CI/CD 파이프라인 격리 — Design

> **MTU ID**: MTU-N108
> **작성일**: 2026-04-10

---

## 아키텍처: Pragmatic Balance

```
테넌트 온보딩 요청
    |
    v
자동화 스크립트 (tenant-cicd-onboarding.sh)
    |
    +-- 네임스페이스 생성 (tenant-{id}-cicd)
    +-- RBAC 자동 주입 (Kyverno ClusterPolicy)
    +-- ResourceQuota 적용
    +-- NetworkPolicy 격리
    +-- Flux GitRepository 연결
    +-- 감사 로그 기록
```

### DS-N108.1: 테넌트 네임스페이스 패턴

- 네이밍: `tenant-{tenant-id}-cicd`
- 라벨: `saas.go.kr/tenant-id`, `saas.go.kr/tier`
- 어노테이션: `saas.go.kr/onboarded-at`, `saas.go.kr/quota-tier`

### DS-N108.2: Kyverno 자동 주입

ClusterPolicy로 `tenant-*-cicd` 네임스페이스 생성 시 자동으로:
- ServiceAccount 생성
- Role + RoleBinding 생성
- 보안 컨텍스트 표준 주입

### DS-N108.3: 리소스 쿼터 티어

| 티어 | CPU | Memory | Pods | PVC |
|------|-----|--------|------|-----|
| basic | 2 core | 4Gi | 10 | 5Gi |
| standard | 4 core | 8Gi | 20 | 20Gi |
| enterprise | 8 core | 16Gi | 50 | 50Gi |

### DS-N108.4: NetworkPolicy 격리

- 기본 정책: deny-all ingress/egress
- 허용: 같은 테넌트 네임스페이스 내 통신만
- 예외: monitoring, kube-system 네임스페이스

## Design Anchor

- Plan SC: FR-N108.1~FR-N108.6 전수 반영
- CSAP: D-08 접근 통제, N2SF 멀티테넌시 격리
