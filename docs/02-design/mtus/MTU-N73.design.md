# MTU-N73: vCluster PR Preview 환경 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead (Opus)

---

## 1. 아키텍처

```
PR Open → Gitea Webhook → Gitea Actions → vcluster create pr-{num}
                                        → kubectl apply (앱 배포)
                                        → PR Comment (접속 URL)
PR Close → Gitea Webhook → Gitea Actions → vcluster delete pr-{num}
```

### 1.1 vCluster 설정

- 격리 수준: 가상 API 서버 + syncer
- 리소스 제한: CPU 500m, Memory 1Gi 상한
- 네트워크: 호스트 클러스터 서비스 접근 차단 (NetworkPolicy)
- 만료: TTL 3일 (CronJob 정리)

### 1.2 PR Preview 워크플로우

```yaml
# PR 오픈 시
on:
  pull_request:
    types: [opened, synchronize]
steps:
  - vcluster create pr-${{ github.event.pull_request.number }}
  - kubectl apply -f deploy/ --context vcluster_pr-${{ github.event.pull_request.number }}
  - comment "Preview: https://pr-{num}.preview.saas.internal"

# PR 닫힘 시
on:
  pull_request:
    types: [closed]
steps:
  - vcluster delete pr-${{ github.event.pull_request.number }}
```

---

## 2. 리소스 정책

### ResourceQuota (per vCluster)
```yaml
spec:
  hard:
    requests.cpu: "500m"
    requests.memory: "1Gi"
    limits.cpu: "1"
    limits.memory: "2Gi"
    pods: "10"
    services: "5"
    persistentvolumeclaims: "3"
```

### LimitRange (per container)
```yaml
spec:
  limits:
    - default:
        cpu: "200m"
        memory: "256Mi"
      defaultRequest:
        cpu: "50m"
        memory: "64Mi"
      max:
        cpu: "500m"
        memory: "1Gi"
      type: Container
```

---

## 3. TTL 자동 만료 설계

CronJob이 매시간 실행, 3일 이상된 vCluster를 자동 삭제

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
