# MTU-N199: Pod Disruption Budget 준수 모니터링 -- Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/MTU-N199-pdb-compliance.plan.md

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | Pragmatic Balance -- kube-state-metrics PDB 메트릭 |
| 메트릭 소스 | kube_poddisruptionbudget_status_* |

## 상세 설계

### 1. Recording Rules

```yaml
pdb:total_count -- 전체 PDB 수
pdb:disruptions_allowed_zero -- disruptionsAllowed 0인 PDB 수
pdb:current_healthy -- 현재 정상 Pod 수
pdb:desired_healthy -- 요구 최소 Pod 수
pdb:availability_ratio -- 가용성 비율
```

### 2. Alerting Rules

| 알림명 | 조건 | 심각도 | for |
|--------|------|--------|-----|
| PDBDisruptionsAllowedZero | disruptionsAllowed = 0 | warning | 10m |
| PDBCurrentBelowDesired | 현재 < 요구 | critical | 5m |
| PDBNotConfigured | 주요 Deployment에 PDB 미설정 | warning | 30m |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
