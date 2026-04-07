# k3s WSL2 클러스터 설치 레시피

| 항목 | 내용 |
|------|------|
| 문서 ID | INFRA-K3S-RECIPE |
| 버전 | 1.2.0 |
| 최종 수정일 | 2026-04-06 |
| 대상 | DevOps 엔지니어, 인프라 운영팀 |
| 설치 소요 시간 | 10분 이내 |
| FR 매핑 | FR-5.1 (10분 이내 k3s 구성), INFR-2 (CSAP-D11 보안) |
| 참조 규정 | REF-01 (CSAP 표준등급), REF-03 (N2SF) |

<!-- Design Ref: MTU-I1-k3s-wsl2.design.md 2.1절 -- 레시피 설계 -->
<!-- Plan SC: WSL2에서 10분 이내 k3s 설치 재현 -->

---

## 1. 사전 요건

### 1.1 시스템 요건

| 요건 | 최소 | 권장 | 확인 명령 |
|------|------|------|---------|
| OS | Windows 10 21H2+ | Windows 11 | `winver` |
| WSL2 | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS | `lsb_release -a` |
| 메모리 | 4GB (WSL2 할당) | 8GB | `free -h` |
| 디스크 | 20GB 여유 | 40GB | `df -h /` |
| CPU | 2코어 | 4코어 | `nproc` |
| Docker | 27.0+ | 최신 | `docker --version` |

> **중요**: 공공기관 SaaS 플랫폼(15개 마이크로서비스 + 포털)을 완전 배포하려면 최소 20GB 디스크, 8GB 메모리를 권장합니다.

### 1.2 WSL2 설정 (`.wslconfig`)

Windows 사용자 디렉토리(`%USERPROFILE%`)에 `.wslconfig` 파일을 생성합니다:

```ini
# %USERPROFILE%/.wslconfig
[wsl2]
memory=8GB
processors=4
swap=0
localhostForwarding=true
kernelCommandLine=cgroup_enable=cpuset cgroup_memory=1 cgroup_enable=memory
```

**중요**: swap은 반드시 비활성화해야 합니다 (Kubernetes 요건).

설정 변경 후 PowerShell에서 WSL 재시작:

```powershell
wsl --shutdown
wsl -d Ubuntu
```

### 1.3 사전 확인 명령

```bash
# WSL2 커널 버전 확인 (5.15+)
uname -r
# 실제 확인값: 6.6.87.2-microsoft-standard-WSL2

# systemd 활성화 확인
systemctl --version

# cgroup v2 확인
cat /sys/fs/cgroup/cgroup.controllers

# swap 비활성화 확인
free -h | grep Swap   # Swap: 0B 이어야 함

# Docker 동작 확인 (이미지 빌드/저장에 필요)
docker info | head -5
```

---

## 2. k3s 설치

### 2.1 실제 검증된 k3s 버전

| 버전 | 검증일 | WSL2 호환성 | 비고 |
|------|--------|------------|------|
| **v1.34.6+k3s1** | 2026-04-06 | ✅ 검증됨 | **권장** — 공공 SaaS 플랫폼 검증 버전 |
| v1.32.x+k3s1 | — | 예상 호환 | 미검증 |
| v1.29.12+k3s1 | 2026-04-05 | ✅ 호환 | 이전 안정 버전 |

> **버전 고정 이유**: CSAP 감리 요건상 운영 환경과 개발 환경의 k3s 버전을 일치시켜야 합니다.

### 2.2 CNI 선택 가이드

| CNI 옵션 | NetworkPolicy | WSL2 적합성 | 리소스 사용 | CSAP-D10 준수 | 권장도 |
|---------|-------------|-----------|----------|-------------|-------|
| **Flannel (기본)** | **미지원** | 최적 | 최소 | **위반** | 개발환경 한정 |
| **kube-router** (프로덕션 권장) | 지원 | 최적 | 낮음 (~50MB) | 준수 | 프로덕션 권장 |
| Calico | 지원 | 보통 | 높음 (~200MB) | 준수 | 가능 |
| Cilium | 지원 | 보통 | 높음 (~300MB) | 준수 | 가능 |

> **개발환경 주의**: Flannel은 NetworkPolicy 미지원으로 CSAP-D10 위반입니다. 개발환경에서는 NetworkPolicy 없이 동작 가능하나, 스테이징/운영에서는 반드시 kube-router 또는 Calico를 사용합니다.

### 2.3 자동 설치 (권장)

```bash
# 자동화 스크립트 실행 (10분 이내)
chmod +x scripts/install-k3s.sh
sudo K3S_VERSION=v1.34.6+k3s1 ./scripts/install-k3s.sh
```

### 2.4 수동 설치

**Step 1: k3s 설치 (버전 고정)**

```bash
# k3s v1.34.6 설치 (2026-04-06 검증)
export INSTALL_K3S_VERSION="v1.34.6+k3s1"

# 옵션 A: NetworkPolicy 없는 개발 환경 (빠른 시작)
curl -sfL https://get.k3s.io | sh -s - \
  --disable=traefik \
  --protect-kernel-defaults \
  --secrets-encryption \
  --write-kubeconfig-mode 600 \
  --cluster-cidr=10.42.0.0/16 \
  --service-cidr=10.43.0.0/16

# 옵션 B: NetworkPolicy 지원 (프로덕션 권장)
curl -sfL https://get.k3s.io | sh -s - \
  --flannel-backend=none \
  --disable=traefik \
  --disable-network-policy \
  --protect-kernel-defaults \
  --secrets-encryption \
  --write-kubeconfig-mode 600 \
  --cluster-cidr=10.42.0.0/16 \
  --service-cidr=10.43.0.0/16
```

**Step 2: kube-router CNI 설치 (옵션 B 선택 시)**

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl apply -f https://raw.githubusercontent.com/cloudnativelabs/kube-router/master/daemonset/kubeadm-kuberouter.yaml
```

**Step 3: kubectl 설정**

```bash
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $(id -u):$(id -g) ~/.kube/config
chmod 600 ~/.kube/config
echo 'export KUBECONFIG=~/.kube/config' >> ~/.bashrc
export KUBECONFIG=~/.kube/config
```

**Step 4: 설치 확인**

```bash
kubectl get nodes
# 예상:
# NAME              STATUS   ROLES           AGE   VERSION
# desktop-8ccjega   Ready    control-plane   1m    v1.34.6+k3s1

kubectl get pods -n kube-system
```

---

## 3. Docker 이미지 → k3s containerd 임포트

k3s는 Docker 데몬과 **독립된** containerd를 사용합니다. `docker build`로 빌드한 이미지는 별도 임포트 과정이 필요합니다.

### 3.1 이미지 임포트 방법

```bash
# 단일 이미지 임포트
docker save saas/auth-service:dev | sudo k3s ctr images import -

# 다수 이미지 일괄 임포트 (공공 SaaS 16개 서비스)
for img in \
  saas/auth-service:dev \
  saas/user-service:dev \
  saas/tenant-service:dev \
  saas/menu-service:dev \
  saas/catalog-service:dev \
  saas/subscription-service:dev \
  saas/billing-service:dev \
  saas/crm-service:dev \
  saas/ai-service:dev \
  saas/notification-service:dev \
  saas/file-service:dev \
  saas/audit-service:dev \
  saas/compliance-service:dev \
  saas/security-monitor-service:dev \
  saas/api-gateway:dev \
  saas/portal:dev; do
    echo -n "Importing ${img}... "
    docker save "${img}" | sudo k3s ctr images import - 2>&1 | grep -E "saved|error" | head -1
done
```

> **주의**: `sudo` 없이 실행하면 `permission denied: /run/k3s/containerd/containerd.sock` 오류가 발생합니다.

### 3.2 임포트 확인

```bash
sudo k3s ctr images list | grep "saas/"
```

### 3.3 Deployment imagePullPolicy 설정

임포트된 로컬 이미지를 사용하려면 Deployment에 반드시 `imagePullPolicy: IfNotPresent`를 설정해야 합니다.

```yaml
spec:
  containers:
  - name: auth-service
    image: saas/auth-service:dev
    imagePullPolicy: IfNotPresent   # ← 필수! Never 사용 가능
```

> `Always`(기본값)로 설정하면 외부 레지스트리에서 Pull을 시도하여 실패합니다.

---

## 4. 공공 SaaS 플랫폼 배포

### 4.1 네임스페이스 및 시크릿 생성

```bash
# 네임스페이스 생성
kubectl apply -f k8s/config/namespace.yaml

# JWT RSA 키 쌍 생성 (최초 1회)
openssl genrsa -out /tmp/jwt_private.pem 2048
openssl rsa -in /tmp/jwt_private.pem -pubout -out /tmp/jwt_public.pem

# 시크릿 생성 (JWT 키 포함)
kubectl create secret generic saas-secrets \
  --namespace=saas-platform \
  --from-literal=DATABASE_URL="postgresql://saas:saas_dev_2026@postgres-svc:5432/saas_platform" \
  --from-literal=REDIS_URL="redis://default:redis_dev_2026@redis-svc:6379" \
  --from-literal=JWT_SECRET="$(openssl rand -hex 32)" \
  --from-literal=DB_USER="saas" \
  --from-literal=DB_PASSWORD="saas_dev_2026" \
  --from-literal=DB_NAME="saas_platform" \
  --from-literal=REDIS_PASSWORD="redis_dev_2026" \
  --from-file=JWT_PRIVATE_KEY=/tmp/jwt_private.pem \
  --from-file=JWT_PUBLIC_KEY=/tmp/jwt_public.pem
```

> **CSAP D-09 준수**: JWT 키는 반드시 k8s Secret으로 관리합니다. YAML 파일에 평문 저장 금지.

### 4.2 인프라(PostgreSQL, Redis) 배포

```bash
kubectl apply -f k8s/infra/postgres.yaml
kubectl apply -f k8s/infra/redis.yaml

# 준비 대기
kubectl wait --namespace=saas-platform \
  --for=condition=ready pod --selector=app=postgres --timeout=120s
kubectl wait --namespace=saas-platform \
  --for=condition=ready pod --selector=app=redis --timeout=60s
```

### 4.3 데이터베이스 스키마 초기화

```bash
# k3s postgres를 로컬에서 포트 포워딩
kubectl port-forward -n saas-platform svc/postgres-svc 15432:5432 &

# Prisma 스키마 적용
DATABASE_URL="postgresql://saas:saas_dev_2026@localhost:15432/saas_platform" \
  pnpm exec prisma db push --schema=prisma/schema.prisma --skip-generate

kill %1 2>/dev/null
```

> **주의**: `prisma migrate deploy`가 아닌 `prisma db push`를 사용합니다. 마이그레이션 이력이 없는 신규 클러스터에 적합합니다.

### 4.4 마이크로서비스 배포

```bash
kubectl apply -f k8s/services/microservices.yaml
kubectl apply -f k8s/portal/portal.yaml

# 모든 파드 Running 대기
kubectl wait --namespace=saas-platform \
  --for=condition=ready pod --all --timeout=300s
```

### 4.5 배포 상태 확인

```bash
kubectl get pods -n saas-platform
# 기대: 19개 파드 모두 Running 상태
# - postgres, redis (2)
# - 14개 마이크로서비스 + api-gateway (15)
# - portal (1)
# - 기타 이전 롤아웃 파드 (재시작 중 일시적으로 증가 가능)

kubectl get svc -n saas-platform
# NodePort:
#   api-gateway  → NodePort 32276
#   portal-svc   → NodePort 30400
```

---

## 5. WSL2 네트워크 접근

### 5.1 NodePort 직접 접근 제한

WSL2 환경에서 k3s 노드 IP(`172.x.x.x`)로 NodePort에 직접 접근이 되지 않을 수 있습니다. **`kubectl port-forward`를 사용합니다.**

```bash
# ❌ WSL2에서 종종 실패
curl http://172.18.120.97:30400/

# ✅ 항상 동작하는 방법
kubectl port-forward -n saas-platform svc/portal-svc 14000:4000 &
kubectl port-forward -n saas-platform svc/api-gateway 13000:3000 &

# 접근
curl http://localhost:14000/        # 포털
curl http://localhost:13000/health  # API Gateway
```

### 5.2 서비스별 포트 포워딩 참조

| 서비스 | ClusterIP 포트 | 권장 로컬 포트 | 명령 |
|--------|---------------|--------------|------|
| portal | 4000 | 14000 | `kubectl port-forward svc/portal-svc 14000:4000 -n saas-platform` |
| api-gateway | 3000 | 13000 | `kubectl port-forward svc/api-gateway 13000:3000 -n saas-platform` |
| auth-service | 3001 | 13001 | `kubectl port-forward svc/auth-service 13001:3001 -n saas-platform` |
| postgres | 5432 | 15432 | `kubectl port-forward svc/postgres-svc 15432:5432 -n saas-platform` |
| redis | 6379 | 16379 | `kubectl port-forward svc/redis-svc 16379:6379 -n saas-platform` |

---

## 6. CSAP-D11 보안 강화

설치 후 반드시 보안 설정을 적용합니다. 상세 체크리스트는 `container-security-baseline.md`를 참조하십시오.

### 6.1 Pod Security Standards (PSS) 적용

```bash
kubectl label namespace saas-platform \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/audit=restricted \
  pod-security.kubernetes.io/warn=restricted
```

### 6.2 NetworkPolicy 기본 차단

```yaml
# deny-all.yaml -- 기본 거부 정책 (CSAP-D10-01 방화벽 운영)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
  namespace: saas-platform
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
```

```bash
kubectl apply -f deny-all.yaml
```

### 6.3 etcd 시크릿 암호화 확인

```bash
sudo cat /var/lib/rancher/k3s/server/cred/encryption-config.json
```

### 6.4 RBAC 기본 설정

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: saas-readonly
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps"]
  verbs: ["get", "list", "watch"]
```

---

## 7. Dockerfile 작성 가이드 (pnpm 모노레포)

pnpm workspace 환경에서 k3s 배포 시 Dockerfile 작성 시 주의사항입니다.

### 7.1 pnpm node_modules 구조 유지 (필수)

pnpm은 심볼릭 링크 기반 가상 store를 사용합니다. runner 스테이지에서 **루트 node_modules 전체**와 **서비스 디렉토리 전체**를 함께 복사해야 합니다.

```dockerfile
# ❌ 잘못된 방법 — 심볼릭 링크 끊김
FROM node:22-alpine AS runner
COPY --from=builder /app/platform/services/auth-service/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]  # ERR_MODULE_NOT_FOUND 발생

# ✅ 올바른 방법 — 디렉토리 구조 유지
FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder --chown=saas:saas /app/node_modules ./node_modules
COPY --from=builder --chown=saas:saas /app/platform/packages ./platform/packages
COPY --from=builder --chown=saas:saas /app/platform/services/auth-service ./platform/services/auth-service
CMD ["node", "platform/services/auth-service/dist/index.js"]
```

### 7.2 Prisma generate (필수)

`@prisma/client`를 사용하는 모든 서비스는 builder 스테이지에서 `prisma generate`를 실행해야 합니다.

```dockerfile
# 소스 복사
COPY platform/services/auth-service/ ./platform/services/auth-service/
COPY prisma/ ./prisma/

# ← 반드시 build 전에 실행
RUN pnpm exec prisma generate

RUN pnpm --filter @public-saas/auth-service... build
```

> **누락 시 증상**: 런타임 오류 `@prisma/client did not initialize yet. Please run "prisma generate"`

### 7.3 Kubernetes 환경 변수 충돌 방지

Kubernetes는 각 Service에 대해 환경 변수를 자동 주입합니다. 서비스명과 겹치는 env var 이름을 사용하면 충돌이 발생합니다.

```bash
# k8s가 auth-service Service에 대해 자동 주입하는 변수
AUTH_SERVICE_PORT=tcp://10.43.127.213:3001   # ← 자동 주입
AUTH_SERVICE_SERVICE_HOST=10.43.127.213       # ← 자동 주입
AUTH_SERVICE_SERVICE_PORT=3001                # ← 자동 주입
```

```typescript
// ❌ 잘못된 방법 — AUTH_SERVICE_PORT가 k8s에 의해 덮어씌워짐
const AUTH_URL = `http://localhost:${process.env.AUTH_SERVICE_PORT}`
// 결과: http://localhost:tcp://10.43.127.213:3001 → TypeError: Invalid URL

// ✅ 올바른 방법 — 충돌 없는 이름 사용
const AUTH_URL = process.env.AUTH_SVC_URL ?? 'http://auth-service:3001'
```

**충돌하는 자동 주입 변수 패턴**: `{SVC_NAME_UPPER}_PORT`, `{SVC_NAME_UPPER}_SERVICE_HOST`, `{SVC_NAME_UPPER}_SERVICE_PORT`

### 7.4 Next.js standalone 모노레포 설정

pnpm 모노레포에서 Next.js standalone 빌드는 추가 설정이 필요합니다.

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  output: 'standalone',
  // ← pnpm 모노레포 필수: 루트 기준 파일 트레이싱
  outputFileTracingRoot: '/app',
};
```

```dockerfile
# standalone 출력 경로: /app/platform/apps/portal/.next/standalone/
# 내부 server.js 위치: /app/platform/apps/portal/server.js (outputFileTracingRoot 기준)

COPY --from=builder /app/platform/apps/portal/.next/standalone ./
COPY --from=builder /app/platform/apps/portal/.next/static ./platform/apps/portal/.next/static

CMD ["node", "platform/apps/portal/server.js"]
```

> **누락 시 증상**: `Cannot find module '/app/server.js'` — server.js가 루트가 아닌 모노레포 경로에 생성됩니다.

---

## 8. 검증

### 8.1 헬스 체크

```bash
# 전체 서비스 헬스 확인
for svc_port in \
  "auth-service:3001" "user-service:3002" "tenant-service:3003" \
  "menu-service:3004" "catalog-service:3005" "subscription-service:3006" \
  "billing-service:3007" "crm-service:3008" "ai-service:3009" \
  "notification-service:3010" "file-service:3011" "audit-service:3012" \
  "compliance-service:3013" "security-monitor-service:3014"; do
  svc="${svc_port%%:*}"
  port="${svc_port##*:}"
  local_port="1${port}"

  kubectl port-forward -n saas-platform "svc/$svc" "${local_port}:${port}" &>/dev/null &
  PF_PID=$!
  sleep 1

  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${local_port}/health")
  echo "${svc}: HTTP ${STATUS} $([ "$STATUS" = "200" ] && echo '✅' || echo '❌')"

  kill $PF_PID 2>/dev/null && wait $PF_PID 2>/dev/null
done
```

### 8.2 인증 기능 검증

```bash
kubectl port-forward -n saas-platform svc/auth-service 13001:3001 &>/dev/null &
sleep 2

# 로그인 테스트 (테넌트 슬러그 필수)
curl -s -X POST http://localhost:13001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@test.com","password":"Admin1234!","tenantSlug":"test-org"}' | \
  python3 -m json.tool
# 기대: success:true, accessToken (JWT RS256), refreshToken 포함

kill %1 2>/dev/null
```

### 8.3 파드 전체 Ready 확인

```bash
kubectl get pods -n saas-platform --no-headers | awk '{print $3}' | sort | uniq -c
# 기대: 모두 Running (19개 파드)
```

---

## 9. 문제 해결 (FAQ)

### FAQ-01: k3s 서비스 시작 실패

```bash
sudo journalctl -xeu k3s.service
# cgroup 설정 확인
cat /proc/cgroups | grep -E 'cpu|memory'
```

### FAQ-02: `docker save | k3s ctr images import` 권한 오류

```bash
# 증상: permission denied: /run/k3s/containerd/containerd.sock
# 해결: sudo 필수
docker save saas/auth-service:dev | sudo k3s ctr images import -
```

### FAQ-03: kubectl 권한 오류

```bash
# 증상: The connection to the server localhost:6443 was refused
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl get nodes
```

### FAQ-04: ERR_MODULE_NOT_FOUND (fastify, prisma 등)

```bash
# 증상: Cannot find package 'fastify' from /app/dist/index.js
# 원인: runner 스테이지에서 pnpm 심볼릭 링크 구조가 깨짐
# 해결: 7.1절 참조 — 루트 node_modules + 서비스 디렉토리 전체 복사
```

### FAQ-05: Prisma 초기화 실패

```bash
# 증상: @prisma/client did not initialize yet
# 원인: Dockerfile에 'prisma generate' 단계 누락
# 해결: 7.2절 참조 — builder 스테이지에 prisma generate 추가

grep "prisma generate" platform/services/*/Dockerfile
# 모든 서비스에 존재해야 함
```

### FAQ-06: Kubernetes env var 충돌 (Invalid URL)

```bash
# 증상: TypeError: Invalid URL — input: http://localhost:tcp://10.43.1.2:3001
# 원인: k8s가 AUTH_SERVICE_PORT를 tcp://IP:PORT 형식으로 자동 주입
# 해결: 7.3절 참조 — AUTH_SVC_URL 등 충돌 없는 변수명 사용
```

### FAQ-07: WSL2 NodePort 접근 불가

```bash
# 증상: curl http://172.18.x.x:30400/ → 연결 실패
# 원인: WSL2 네트워크 인터페이스에서 k3s NodePort 직접 접근 제한
# 해결: kubectl port-forward 사용 (5.1절 참조)
kubectl port-forward -n saas-platform svc/portal-svc 14000:4000 &
curl http://localhost:14000/
```

### FAQ-08: Prisma DB Push 실패

```bash
# 증상: P1001 Can't reach database server
# 원인: k3s postgres에 직접 접근 불가
# 해결: port-forward로 postgres 노출 후 실행
kubectl port-forward -n saas-platform svc/postgres-svc 15432:5432 &
DATABASE_URL="postgresql://saas:saas_dev_2026@localhost:15432/saas_platform" \
  pnpm exec prisma db push --schema=prisma/schema.prisma --skip-generate
kill %1
```

### FAQ-09: Next.js portal `Cannot find module '/app/server.js'`

```bash
# 원인: outputFileTracingRoot 미설정으로 server.js 경로가 /app/server.js가 아님
# 실제 경로: /app/platform/apps/portal/server.js
# 해결: 7.4절 참조 — next.config.ts에 outputFileTracingRoot: '/app' 추가
#        CMD를 "node platform/apps/portal/server.js"로 변경
```

### FAQ-10: BigInt JSON 직렬화 오류

```bash
# 증상: Internal Server Error — Do not know how to serialize a BigInt
# 원인: Prisma BigInt 타입(예: maxStorage)이 JSON.stringify 불가
# 해결: API 핸들러에서 .toString() 변환
# 예시: { ...tenant, maxStorage: tenant.maxStorage.toString() }
```

### FAQ-11: WSL2 메모리 부족 (OOMKilled)

```bash
# 증상: OOMKilled Pod 발생
# 해결: .wslconfig 메모리 증가
# memory=4GB → memory=8GB
# WSL 재시작 후 확인: free -h
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.2.0 | 2026-04-06 | 실제 배포 검증 기반 대규모 업데이트 — k3s v1.34.6 검증, Docker→k3s 이미지 임포트, pnpm 모노레포 Dockerfile 패턴, k8s env var 충돌 해결, Next.js standalone 모노레포, WSL2 포트포워딩, BigInt 직렬화, FAQ 11개 추가 | Claude Code |
| 1.0.0 | 2026-04-05 | 최초 작성 — 5섹션 레시피, kube-router CNI, CSAP-D11 보안 | Claude Code (PM Lead) |
