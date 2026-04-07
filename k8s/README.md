# k8s/ -- Kubernetes (k3s) 배포 매니페스트

> 공공기관 SaaS 프레임워크 k3s 클러스터 배포용
> CSAP D-10 (네트워크 보안) + D-11 (가상화 보안) + D-09 (암호화) 준수

## 디렉토리 구조

```
k8s/
  config/
    namespace.yaml          # saas-platform 네임스페이스
    configmap.yaml          # 비민감 설정 (서비스 디스커버리, 환경 변수)
    network-policy.yaml     # NetworkPolicy (CSAP D-10: 서비스 간 통신 격리)
    secrets.example.yaml    # Secret 템플릿 (실제 값 미포함)
    secrets.yaml            # 실제 Secret (gitignore 대상 -- 커밋 금지)
  infra/
    postgres.yaml           # PostgreSQL 16 (개발용 emptyDir)
    redis.yaml              # Redis 7 (Secret 참조 비밀번호)
    minio.yaml              # MinIO S3 호환 스토리지
  portal/
    portal.yaml             # Next.js 15 포털 (NodePort 30400)
  services/
    microservices.yaml      # 마이크로서비스 15종 전수 매니페스트
```

## 배포 순서

```bash
# 1. 네임스페이스 생성
kubectl apply -f k8s/config/namespace.yaml

# 2. Secret 생성 (secrets.example.yaml 참조하여 secrets.yaml 작성)
kubectl apply -f k8s/config/secrets.yaml

# 3. ConfigMap 적용
kubectl apply -f k8s/config/configmap.yaml

# 3-1. NetworkPolicy 적용 (CSAP D-10)
kubectl apply -f k8s/config/network-policy.yaml

# 4. 인프라 (DB, Redis, MinIO)
kubectl apply -f k8s/infra/

# 5. 마이크로서비스 15종
kubectl apply -f k8s/services/microservices.yaml

# 6. 포털
kubectl apply -f k8s/portal/portal.yaml

# 7. 확인
kubectl get pods -n saas-platform
kubectl get svc -n saas-platform
```

## 서비스 포트 매핑

| 서비스 | 포트 | NodePort |
|--------|------|----------|
| api-gateway | 3000 | - |
| auth-service | 3001 | - |
| user-service | 3002 | - |
| tenant-service | 3003 | - |
| menu-service | 3004 | - |
| catalog-service | 3005 | - |
| subscription-service | 3006 | - |
| billing-service | 3007 | - |
| crm-service | 3008 | - |
| ai-service | 3009 | - |
| notification-service | 3010 | - |
| file-service | 3011 | - |
| audit-service | 3012 | - |
| compliance-service | 3013 | - |
| security-monitor-service | 3014 | - |
| portal | 4000 | 30400 |

## 보안 참고사항 (CSAP D-09, D-10, D-11)

- `secrets.yaml`은 `.gitignore`에 의해 커밋 대상에서 제외됩니다.
- `secrets.example.yaml`을 참조하여 환경별 Secret을 생성하십시오.
- 운영 환경에서는 Sealed Secrets 또는 Vault 연동을 권장합니다.
- Redis 비밀번호는 Secret 참조 방식으로 주입됩니다.

### 네트워크 격리 (CSAP D-10)
- `network-policy.yaml`로 기본 Ingress 차단 (deny-all) 정책 적용
- API 게이트웨이만 외부 트래픽 수신 허용 (유일한 진입점)
- 마이크로서비스는 API 게이트웨이에서만 접근 가능
- 인프라(PostgreSQL, Redis, MinIO)는 필요한 서비스에서만 접근 가능

### 컨테이너 보안 강화 (CSAP D-11)
- 모든 Pod: `runAsNonRoot: true`, `runAsUser: 1001`
- 모든 컨테이너: `readOnlyRootFilesystem: true`, `allowPrivilegeEscalation: false`
- 모든 컨테이너: `capabilities.drop: ["ALL"]`
- 모든 서비스: `livenessProbe` + `readinessProbe` 설정
- 모든 서비스: CPU/메모리 requests/limits 설정
- audit-service: replicas 3 + PDB minAvailable 2 (고가용성)
