# 인프라 FAQ

> **문서 ID**: ONBOARD-11-INFRA
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **대상**: 인프라·DevOps 엔지니어
> **질문 수**: 20개

---

## Pod 장애 및 재시작

---

**Q1. Pod이 계속 재시작돼요. 원인을 어떻게 찾아요?**

A: 단계별로 원인을 추적합니다.

```bash
# 1. Pod 상태 확인
kubectl get pods -n saas-platform

# NAME                      READY   STATUS             RESTARTS   AGE
# auth-service-xxx-yyy      0/1     CrashLoopBackOff   5          10m

# 2. 재시작 원인 확인
kubectl describe pod auth-service-xxx-yyy -n saas-platform

# 출력에서 확인할 부분:
# - Last State: Terminated, Reason: OOMKilled  → 메모리 부족
# - Last State: Terminated, Reason: Error       → 애플리케이션 오류
# - Events: ... Readiness probe failed          → 헬스 체크 실패

# 3. 로그 확인 (현재 컨테이너)
kubectl logs auth-service-xxx-yyy -n saas-platform

# 4. 이전 컨테이너 로그 (재시작 전)
kubectl logs auth-service-xxx-yyy -n saas-platform --previous
```

**자주 나오는 원인 요약**:

| 상태 | 원인 | 해결 방법 |
|------|------|---------|
| OOMKilled | 메모리 제한 초과 | `limits.memory` 값 증가 |
| CrashLoopBackOff | 앱 시작 오류 | 로그에서 오류 메시지 확인 |
| Error (Exit 1) | 환경 변수 누락 | ConfigMap/Secret 확인 |
| ImagePullBackOff | 이미지 없음 | 이미지 태그 확인 |

---

**Q2. OOMKilled가 뭐예요? 어떻게 고쳐요?**

A: Out Of Memory Killed의 약자로, Pod이 설정된 메모리 제한을 초과해 강제 종료된 것입니다.

```bash
# 현재 메모리 설정 확인
kubectl get deployment auth-service -n saas-platform -o yaml | grep -A 10 resources

# 실제 메모리 사용량 확인
kubectl top pod -n saas-platform -l app=auth-service

# 메모리 제한 증가
kubectl set resources deployment auth-service \
  -n saas-platform \
  --limits=memory=512Mi \
  --requests=memory=128Mi
```

메모리 제한 설정 기준: 실제 사용량의 2~3배를 `limits`로 설정합니다.

```yaml
# 권장 설정 예시
resources:
  requests:
    memory: "128Mi"   # 스케줄러가 노드 선택 시 기준
    cpu: "100m"
  limits:
    memory: "512Mi"   # 실제 사용량(~150Mi)의 3배
    cpu: "500m"
```

---

## 서비스 접근 불가

---

**Q3. 서비스에 접근이 안 돼요. 어디서부터 확인해요?**

A: 계층별로 확인합니다.

```bash
# 1. Pod이 Running 상태인지 확인
kubectl get pods -n saas-platform -l app={서비스명}

# 2. Service 엔드포인트 확인
kubectl get endpoints {서비스명} -n saas-platform
# ENDPOINTS가 <none>이면 Pod selector 문제

# 3. Service 설정 확인
kubectl get svc {서비스명} -n saas-platform -o yaml

# 4. Pod 내부에서 직접 호출 테스트
kubectl exec -it {pod-name} -n saas-platform -- curl localhost:3001/health/ping

# 5. 다른 Pod에서 Service로 호출 테스트
kubectl run debug-pod --rm -it --image=curlimages/curl -- \
  curl http://{서비스명}.saas-platform.svc.cluster.local:3001/health/ping

# 6. Ingress 설정 확인 (외부 접근의 경우)
kubectl get ingress -n saas-platform
kubectl describe ingress {ingress-name} -n saas-platform
```

---

## Helm 및 GitOps

---

**Q4. Helm 차트를 수정했는데 반영이 안 돼요.**

A: 이 프로젝트는 Flux GitOps를 사용합니다. 파일을 변경하고 push하면 Flux가 자동으로 클러스터에 적용합니다.

```bash
# Flux 동기화 상태 확인
flux get all -n flux-system

# 강제 동기화 (기다리기 싫을 때)
flux reconcile kustomization saas-platform

# HelmRelease 상태 확인
flux get helmreleases -n saas-platform

# 동기화 오류 확인
kubectl describe helmrelease {릴리스명} -n saas-platform
```

**주의**: `helm upgrade` 명령을 직접 실행하면 Flux와 충돌합니다. 반드시 git push로만 변경하십시오.

---

**Q5. Flux가 뭐예요? ArgoCD와 다른가요?**

A: 둘 다 GitOps 도구로, git 저장소를 "진실의 소스"로 삼아 k8s 클러스터를 자동 동기화합니다.

| 항목 | Flux | ArgoCD |
|------|------|--------|
| UI | CLI 중심 | 웹 UI 제공 |
| 설치 방식 | k8s CRD 기반 | 별도 서버 |
| 멀티 클러스터 | 기본 지원 | 플러그인 필요 |
| Helm 지원 | HelmRelease CRD | 기본 지원 |

이 프로젝트는 **Flux**를 사용합니다. 이유: 경량이고 k8s 네이티브이며, 멀티 테넌트 환경에서 더 세밀한 접근 제어가 가능합니다.

---

**Q6. values.yaml을 수정했는데 Flux가 "drift detected"라고 해요.**

A: 클러스터 상태와 git 상태가 달라서 Flux가 감지한 것입니다.

```bash
# Flux가 git 상태로 덮어쓰도록 강제 동기화
flux reconcile helmrelease {릴리스명} -n saas-platform --force

# 현재 클러스터 상태와 git 상태 비교
flux diff kustomization saas-platform
```

**원인**: `kubectl edit` 또는 `helm upgrade`로 직접 변경하면 git과 클러스터 상태가 달라집니다. 항상 git 파일을 수정하고 push하십시오.

---

## 네트워크

---

**Q7. Ingress와 Service의 차이가 뭐예요?**

A:

```
외부 트래픽 → [Ingress] → [Service] → [Pod]
```

- **Service**: k8s 내부 로드밸런서. Pod IP가 바뀌어도 안정적인 주소를 제공합니다.
- **Ingress**: 외부 HTTP/HTTPS 트래픽을 Service로 라우팅하는 규칙입니다. 도메인별, 경로별 라우팅이 가능합니다.

```yaml
# Service 예시 — 내부 DNS: auth-service.saas-platform.svc.cluster.local
apiVersion: v1
kind: Service
metadata:
  name: auth-service
  namespace: saas-platform
spec:
  selector:
    app: auth-service
  ports:
    - port: 3001
      targetPort: 3001

# Ingress 예시 — 외부 도메인 라우팅
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: saas-ingress
spec:
  rules:
    - host: api.saas.local
      http:
        paths:
          - path: /auth
            pathType: Prefix
            backend:
              service:
                name: auth-service
                port:
                  number: 3001
```

---

**Q8. ClusterIP, NodePort, LoadBalancer 차이가 뭐예요?**

A: Service의 타입입니다.

| 타입 | 접근 범위 | 용도 |
|------|---------|------|
| ClusterIP (기본) | 클러스터 내부만 | 서비스 간 통신 |
| NodePort | 노드 IP + 포트 | 개발 환경 외부 접근 |
| LoadBalancer | 외부 로드밸런서 | 클라우드 환경 |

이 프로젝트: 대부분 **ClusterIP** + **Ingress**를 사용합니다. `NodePort`는 개발 디버깅 시 임시 사용.

---

## 스토리지

---

**Q9. PVC가 왜 Pending 상태예요?**

A: 스토리지 클래스와 노드에 가용한 스토리지가 없어서입니다.

```bash
# PVC 상태 확인
kubectl get pvc -n saas-platform

# PVC 이벤트 확인
kubectl describe pvc {pvc-name} -n saas-platform

# StorageClass 확인
kubectl get storageclass
```

**흔한 원인 1**: StorageClass가 없음

```bash
# k3s에서 기본 StorageClass 확인
kubectl get storageclass
# NAME                   PROVISIONER             RECLAIMPOLICY
# local-path (default)   rancher.io/local-path   Delete

# 없으면 local-path provisioner 설치
kubectl apply -f https://raw.githubusercontent.com/rancher/local-path-provisioner/main/deploy/local-path-storage.yaml
```

**흔한 원인 2**: PVC 용량이 너무 큼 — 노드 디스크 여유 공간 확인

```bash
kubectl describe node saas-node | grep -A 5 "Allocated resources"
```

---

## CI/CD 파이프라인

---

**Q10. CI 파이프라인이 실패했는데 재실행하는 방법은 뭐예요?**

A:

```bash
# Gitea Actions 재실행: Gitea Web UI → Actions → 실패한 워크플로우 → Re-run

# 또는 빈 커밋으로 재트리거
git commit --allow-empty -m "ci: 파이프라인 재실행"
git push origin {브랜치명}
```

---

**Q11. 빌드는 성공했는데 배포가 안 돼요.**

A: Flux 동기화 상태를 확인합니다.

```bash
# Flux 전체 상태 확인
flux get all

# 특정 kustomization 상태
flux get kustomization saas-platform

# 오류 메시지 확인
kubectl describe kustomization saas-platform -n flux-system

# 이미지 자동 업데이트 상태 확인
flux get image automations
flux get image repositories
```

---

**Q12. Docker 이미지 빌드가 너무 느려요.**

A: BuildKit 캐시 레이어를 활용합니다.

```bash
# BuildKit 활성화
export DOCKER_BUILDKIT=1

# 캐시 마운트 활용 (Dockerfile에 추가)
# RUN --mount=type=cache,target=/root/.pnpm-store \
#     pnpm install --frozen-lockfile

# 멀티 스테이지 빌드 확인
cat platform/services/auth-service/Dockerfile
```

---

## 디버깅

---

**Q13. Pod 내부로 접속해서 디버깅하고 싶어요.**

A:

```bash
# 실행 중인 Pod에 셸 접속
kubectl exec -it {pod-name} -n saas-platform -- /bin/sh

# bash가 없으면 (Alpine 이미지)
kubectl exec -it {pod-name} -n saas-platform -- sh

# 특정 명령어만 실행
kubectl exec {pod-name} -n saas-platform -- env | grep DATABASE

# 디버그 전용 임시 Pod 실행
kubectl run debug --rm -it --image=busybox -n saas-platform -- sh
```

---

**Q14. 서비스 로그를 실시간으로 보고 싶어요.**

A:

```bash
# 단일 Pod 로그 스트리밍
kubectl logs -f {pod-name} -n saas-platform

# 레이블로 여러 Pod 로그 동시 확인 (stern 설치 필요)
stern auth-service -n saas-platform

# stern 설치
curl -L https://github.com/stern/stern/releases/latest/download/stern_linux_amd64.tar.gz | tar -xz
sudo mv stern /usr/local/bin/

# 특정 패턴만 필터링
kubectl logs -f {pod-name} -n saas-platform | grep ERROR
```

---

**Q15. 노드가 NotReady 상태예요. 어떻게 복구해요?**

A:

```bash
# 노드 상태 확인
kubectl get nodes
kubectl describe node saas-node

# WSL2 환경에서 k3s 재시작
sudo systemctl restart k3s

# 노드 이벤트 확인
kubectl get events -n kube-system --sort-by='.lastTimestamp' | tail -20

# k3s 로그 확인
journalctl -u k3s -f --no-pager
```

---

## 보안 및 접근 제어

---

**Q16. RBAC 설정을 잘못해서 서비스가 권한 오류를 내요.**

A:

```bash
# ServiceAccount 확인
kubectl get serviceaccount -n saas-platform

# ClusterRole/Role 확인
kubectl get clusterrole | grep saas
kubectl get role -n saas-platform

# 권한 확인
kubectl auth can-i get pods -n saas-platform --as=system:serviceaccount:saas-platform:auth-service

# 상세 권한 오류 분석
kubectl describe pod {pod-name} -n saas-platform | grep -i "forbidden\|denied"
```

---

**Q17. Secret이 Pod에 제대로 마운트되지 않았어요.**

A:

```bash
# Secret 존재 확인
kubectl get secret -n saas-platform

# Secret 내용 확인 (base64 디코딩)
kubectl get secret {secret-name} -n saas-platform -o jsonpath='{.data}' | jq 'to_entries | map({key, value: (.value | @base64d)})'

# Pod의 환경 변수 확인
kubectl exec {pod-name} -n saas-platform -- env | grep SECRET_NAME

# Volume 마운트 확인
kubectl exec {pod-name} -n saas-platform -- ls /var/secrets
```

---

## 네임스페이스

---

**Q18. 어떤 네임스페이스를 써야 해요?**

A: 이 프로젝트의 네임스페이스 구조입니다.

| 네임스페이스 | 용도 |
|------------|------|
| `saas-platform` | 모든 비즈니스 서비스 (auth, user, billing 등) |
| `monitoring` | Prometheus, Grafana, Alertmanager |
| `flux-system` | Flux GitOps 컨트롤러 |
| `cert-manager` | TLS 인증서 관리 |
| `ingress-nginx` | Ingress 컨트롤러 |

개발 중 사용하는 기본 명령:

```bash
# 기본 네임스페이스 설정 (매번 -n 생략 가능)
kubectl config set-context --current --namespace=saas-platform
```

---

**Q19. 리소스를 실수로 삭제했어요. 복구할 수 있나요?**

A: Flux GitOps 덕분에 git 상태로 자동 복구됩니다.

```bash
# 실수로 삭제한 경우 Flux가 자동 복구 (기본 1분 이내)
kubectl delete deployment auth-service -n saas-platform
# 1분 후 Flux가 다시 생성

# 즉시 복구하려면
flux reconcile kustomization saas-platform
```

Flux 없이 실수로 삭제한 경우:

```bash
# git에서 마지막 상태로 재배포
git checkout stg
helm upgrade auth-service platform/helm/auth-service -n saas-platform
```

---

**Q20. k8s 클러스터 전체 자원 사용량을 보고 싶어요.**

A:

```bash
# 노드별 자원 사용량
kubectl top nodes

# Pod별 자원 사용량
kubectl top pods -n saas-platform

# 모든 네임스페이스
kubectl top pods --all-namespaces

# 자원 할당량 확인 (requests vs 실제)
kubectl describe node saas-node | grep -A 20 "Allocated resources"
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 초안 작성 (20개 질문) | Implementer (Sonnet) |
