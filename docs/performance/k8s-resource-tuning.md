# k8s 리소스 튜닝 가이드

> Plan SC: FR-N19.2
> Design Ref: D-N19.2
> CSAP: D-07 가용성, D-11 가상화 보안

| 항목 | 내용 |
|------|------|
| 버전 | 1.0.0 |
| 작성일 | 2026-04-08 |
| 대상 | k8s/services/microservices.yaml, Helm Chart |

---

## 1. 서비스별 권장 리소스

### 핵심 서비스 (높은 부하)

| 서비스 | CPU requests | CPU limits | Memory requests | Memory limits | 비고 |
|--------|-------------|-----------|----------------|--------------|------|
| api-gateway | 100m | 500m | 128Mi | 256Mi | 모든 요청 통과, rate limit, 프록시 |
| auth-service | 100m | 300m | 64Mi | 128Mi | bcrypt CPU 집약적 (cost=12) |
| audit-service | 100m | 300m | 128Mi | 256Mi | SHA-256 체인 연산, append-only |
| ai-service | 100m | 500m | 128Mi | 256Mi | LLM API 프록시 (비동기 I/O) |
| security-monitor | 100m | 300m | 128Mi | 256Mi | 로그인 실패 분석, 이상 탐지 |

### 경량 서비스 (CRUD 위주)

| 서비스 | CPU requests | CPU limits | Memory requests | Memory limits |
|--------|-------------|-----------|----------------|--------------|
| user-service | 50m | 200m | 64Mi | 128Mi |
| tenant-service | 50m | 200m | 64Mi | 128Mi |
| menu-service | 50m | 200m | 64Mi | 128Mi |
| catalog-service | 50m | 200m | 64Mi | 128Mi |
| subscription-service | 50m | 200m | 64Mi | 128Mi |
| billing-service | 50m | 200m | 64Mi | 128Mi |
| crm-service | 50m | 200m | 64Mi | 128Mi |
| notification-service | 50m | 200m | 64Mi | 128Mi |
| file-service | 50m | 200m | 64Mi | 128Mi |
| compliance-service | 50m | 200m | 64Mi | 128Mi |
| security-service | 50m | 200m | 64Mi | 128Mi |

### 포털 (Next.js SSR)

| 서비스 | CPU requests | CPU limits | Memory requests | Memory limits |
|--------|-------------|-----------|----------------|--------------|
| portal | 100m | 500m | 128Mi | 512Mi |
| admin-portal | 100m | 500m | 128Mi | 512Mi |
| tenant-portal | 100m | 500m | 128Mi | 512Mi |

### 인프라

| 서비스 | CPU requests | CPU limits | Memory requests | Memory limits | 비고 |
|--------|-------------|-----------|----------------|--------------|------|
| PostgreSQL | 200m | 1000m | 512Mi | 1Gi | shared_buffers=256MB |
| Redis | 50m | 200m | 64Mi | 128Mi | maxmemory=100mb |
| MinIO | 100m | 500m | 128Mi | 256Mi | 오브젝트 스토리지 |

---

## 2. 총 리소스 예산

### 최소 환경 (WSL2 8GB RAM)

| 항목 | CPU requests | Memory requests |
|------|-------------|----------------|
| 핵심 서비스 (5개) | 500m | 576Mi |
| 경량 서비스 (11개) | 550m | 704Mi |
| 포털 (3개) | 300m | 384Mi |
| 인프라 (3개) | 350m | 704Mi |
| k3s 시스템 | 500m | 512Mi |
| **총계** | **2200m** | **2880Mi (~2.8GB)** |

여유: 8GB WSL2 - 2.8GB = 5.2GB (버스트 + 시스템 사용)

### 권장 환경 (WSL2 16GB RAM)

- requests 총합: ~2.8GB
- limits 총합: ~5.5GB
- 여유: 16GB - 5.5GB = 10.5GB (충분)

---

## 3. k3s 최적화 설치 옵션

```bash
# 불필요 컴포넌트 비활성화 (~70MB RAM 절약)
curl -sfL https://get.k3s.io | sh -s - \
  --disable traefik \        # Traefik 비활성화 (~50MB 절약)
  --disable servicelb \      # ServiceLB 비활성화 (~20MB 절약)
  --kubelet-arg="--max-pods=50" \  # Pod 수 제한
  --kubelet-arg="--eviction-hard=memory.available<200Mi" \  # OOM 방어
  --kubelet-arg="--system-reserved=cpu=200m,memory=256Mi"   # 시스템 예약
```

### systemd 리소스 제한 (선택)

```ini
# /etc/systemd/system/k3s.service.d/resource-limits.conf
[Service]
CPUQuota=400%       # 4 코어 제한
MemoryMax=6G        # 최대 6GB
MemoryHigh=5G       # 5GB 초과 시 경고
```

---

## 4. Pod Disruption Budget (PDB)

```yaml
# 핵심 서비스 PDB 설정
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-gateway-pdb
  namespace: saas
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: api-gateway
```

---

## 5. Horizontal Pod Autoscaler (HPA) 권고

```yaml
# 프로덕션 환경용 (WSL2 개발 환경에서는 비활성화 권장)
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 1
  maxReplicas: 3
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

---

## 6. 리소스 모니터링 체크리스트

- [ ] `kubectl top nodes` -- 노드 리소스 사용률 확인
- [ ] `kubectl top pods -n saas` -- Pod별 사용률 확인
- [ ] Prometheus `container_memory_working_set_bytes` 메트릭 대시보드 확인
- [ ] OOMKilled 이벤트 모니터링: `kubectl get events --field-selector reason=OOMKilling`
- [ ] CPU 스로틀링 확인: Prometheus `container_cpu_cfs_throttled_periods_total`

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초안 작성 | PM Lead Agent |
