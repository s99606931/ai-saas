# MTU-N162: 멀티클러스터 페더레이션 정책 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead  
> **Plan 참조**: `docs/01-plan/mtus/MTU-N162-multicluster-federation.plan.md`

---

## 1. Design Anchor

| 항목 | 결정 |
|------|------|
| 페더레이션 방식 | Linkerd multicluster + Prometheus federation |
| 정책 동기화 | Kyverno ClusterPolicy replicate |
| 서비스 디스커버리 | Linkerd multicluster mirror |
| 보안 | 클러스터 간 mTLS (Linkerd trust anchor 공유) |

---

## 2. 아키텍처

```
[클러스터 A (Primary)]                [클러스터 B (Secondary)]
  Linkerd Control Plane  <--mTLS-->    Linkerd Control Plane
  Kyverno Policies       <--sync-->    Kyverno Policies
  Prometheus             <--fed-->     Prometheus
  Thanos Sidecar         <--query-->   Thanos Sidecar
```

---

## 3. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 설계 | PM Lead |
