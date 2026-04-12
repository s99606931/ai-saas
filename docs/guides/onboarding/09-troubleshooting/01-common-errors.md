# 9장 1절: 자주 발생하는 오류와 해결법

> **버전**: 1.1.0 | **작성일**: 2026-04-12
> **대상**: 전체 역할 (개발자, DevOps, 인프라)
> **CSAP**: D-06 (침해사고 관리), D-08 (접근 통제), D-12 (시스템 개발 보안)

---

## 목차

1. [개발 환경 오류](#1-개발-환경-오류)
   - 1.1 pnpm install 실패
   - 1.2 .env 파일 없음
   - 1.3 TypeScript 컴파일 오류
   - 1.4 Prisma migrate 실패
2. [k3s / Kubernetes 오류](#2-k3s--kubernetes-오류)
   - 2.1 CrashLoopBackOff
   - 2.2 ImagePullBackOff
   - 2.3 서비스 접근 불가 (Ingress / DNS)
   - 2.4 PVC Pending
   - 2.5 OOMKilled
3. [CI/CD 오류](#3-cicd-오류)
   - 3.1 Lint 단계 실패
   - 3.2 Docker 빌드 실패
   - 3.3 Helm 배포 실패
   - 3.4 Q-Gate 실패
4. [보안 / 인증 오류](#4-보안--인증-오류)
   - 4.1 JWT 토큰 만료
   - 4.2 401 Unauthorized vs 403 Forbidden
   - 4.3 CSAP 감사 로그 누락
5. [모니터링 오류](#5-모니터링-오류)
   - 5.1 Prometheus 타겟 다운
   - 5.2 Grafana 대시보드 데이터 없음
   - 5.3 알림 미발송

---

## 트러블슈팅 결정 트리

문제가 발생했을 때 어느 카테고리인지 먼저 파악하십시오.

```mermaid
flowchart TD
  START([문제 발생]) --> Q1{로컬 개발 중인가?}

  Q1 -->|예| Q2{npm/pnpm 관련인가?}
  Q2 -->|예| FIX_NPM["1절 개발환경 오류\n§1.1 pnpm install"]
  Q2 -->|아니오| Q3{코드 컴파일 오류인가?}
  Q3 -->|예| FIX_TS["1절 개발환경 오류\n§1.3 TypeScript 오류"]
  Q3 -->|아니오| FIX_ENV["1절 개발환경 오류\n§1.2 .env 파일"]

  Q1 -->|아니오| Q4{k8s Pod 상태 이상인가?}
  Q4 -->|예| Q5{kubectl get pods 상태?}
  Q5 -->|CrashLoopBackOff| FIX_CRASH["2절 k3s 오류\n§2.1 CrashLoopBackOff"]
  Q5 -->|ImagePullBackOff| FIX_IMG["2절 k3s 오류\n§2.2 ImagePullBackOff"]
  Q5 -->|Pending| Q6{PVC 관련인가?}
  Q6 -->|예| FIX_PVC["2절 k3s 오류\n§2.4 PVC Pending"]
  Q6 -->|아니오| FIX_SCHED["스케줄러 문제\nkubectl describe pod"]
  Q5 -->|OOMKilled| FIX_OOM["2절 k3s 오류\n§2.5 OOMKilled"]

  Q4 -->|아니오| Q7{CI/CD 파이프라인 실패인가?}
  Q7 -->|예| Q8{어느 단계?}
  Q8 -->|Lint/빌드| FIX_LINT["3절 CI/CD 오류\n§3.1 Lint 실패"]
  Q8 -->|Docker 빌드| FIX_DOCKER["3절 CI/CD 오류\n§3.2 Docker 빌드"]
  Q8 -->|Helm 배포| FIX_HELM["3절 CI/CD 오류\n§3.3 Helm 배포"]
  Q8 -->|Q-Gate| FIX_QGATE["3절 CI/CD 오류\n§3.4 Q-Gate"]

  Q7 -->|아니오| Q9{인증/보안 오류인가?}
  Q9 -->|예| Q10{HTTP 상태 코드?}
  Q10 -->|401| FIX_401["4절 인증 오류\n§4.2 401 Unauthorized"]
  Q10 -->|403| FIX_403["4절 인증 오류\n§4.2 403 Forbidden"]
  Q10 -->|JWT 관련| FIX_JWT["4절 인증 오류\n§4.1 JWT 만료"]

  Q9 -->|아니오| Q11{모니터링 이상?}
  Q11 -->|메트릭 없음| FIX_PROM["5절 모니터링\n§5.1 Prometheus 타겟"]
  Q11 -->|대시보드 빈칸| FIX_GRAF["5절 모니터링\n§5.2 Grafana"]
  Q11 -->|알림 안 옴| FIX_ALERT["5절 모니터링\n§5.3 알림"]

  style START fill:#4CAF50,color:#fff
  style FIX_CRASH fill:#F44336,color:#fff
  style FIX_IMG fill:#F44336,color:#fff
  style FIX_OOM fill:#F44336,color:#fff
```

---

## 1. 개발 환경 오류

### 1.1 pnpm install 실패

#### 오류 유형 A — Node.js 버전 불일치

```
에러 메시지:
  ERR_PNPM_UNSUPPORTED_ENGINE
  Unsupported environment (bad pnpm and/or Node.js version)
  Your Node.js version is incompatible with "node": ">=22.0.0"

원인:
  프로젝트는 Node.js 22 이상을 요구하지만 이전 버전이 설치되어 있음

해결:
  # 1. 현재 버전 확인
  node --version

  # 2. nvm으로 버전 전환
  nvm install 22
  nvm use 22

  # 3. .nvmrc 파일이 있으면
  cat .nvmrc        # "22" 출력 확인
  nvm use           # 자동으로 .nvmrc 버전 적용

  # 4. 재설치
  pnpm install --frozen-lockfile

예방: 쉘 프로필(~/.zshrc 또는 ~/.bashrc)에 자동 전환 추가
  # .zshrc 마지막 줄에 추가
  autoload -U add-zsh-hook
  load-nvmrc() { [[ -f .nvmrc ]] && nvm use; }
  add-zsh-hook chpwd load-nvmrc
```

#### 오류 유형 B — 사내 레지스트리 연결 실패

```
에러 메시지:
  ECONNREFUSED
  connect ECONNREFUSED 10.0.0.1:4873
  또는: fetch failed: https://registry.npmjs.org/

원인:
  사내 npm 레지스트리(Verdaccio) 접근 불가
  VPN 미연결 또는 방화벽 차단

해결:
  # 1. 현재 레지스트리 확인
  pnpm config get registry

  # 2. 사내 레지스트리로 전환
  pnpm config set registry http://verdaccio.saas.local:4873

  # 3. VPN 연결 확인 후 재시도
  ping verdaccio.saas.local

  # 4. 외부 직접 연결이 허용된 환경이라면
  pnpm config set registry https://registry.npmjs.org

예방: 팀 공용 .npmrc 파일이 저장소에 포함되어 있으므로 건드리지 말 것
```

#### 오류 유형 C — lockfile 불일치

```
에러 메시지:
  ERR_PNPM_OUTDATED_LOCKFILE
  Cannot proceed with frozen-lockfile install because
  pnpm-lock.yaml is not up to date with package.json

원인:
  다른 팀원이 package.json에 의존성을 추가했으나
  pnpm-lock.yaml을 커밋하지 않았거나
  두 브랜치의 의존성이 충돌함

해결:
  # git pull 후 lockfile 재생성 (로컬 개발 환경에서만)
  git pull origin main
  pnpm install          # frozen-lockfile 옵션 없이 실행

  # 변경된 lockfile 커밋
  git add pnpm-lock.yaml
  git commit -m "chore: pnpm lockfile 업데이트 (의존성 동기화)"

예방: PR 리뷰 시 package.json 변경 시 pnpm-lock.yaml도 함께 변경 확인
```

#### 오류 유형 D — 디스크 공간 부족

```
에러 메시지:
  ENOSPC: no space left on device, write

원인:
  pnpm 글로벌 스토어 또는 node_modules 용량 초과

해결:
  # 1. 디스크 사용량 확인
  df -h

  # 2. pnpm 캐시 정리
  pnpm store prune

  # 3. node_modules 전체 재설치 (느리지만 확실)
  find /data/ai-saas -name "node_modules" -maxdepth 4 -type d \
    -not -path "*/\.*" | xargs rm -rf
  pnpm install

예방: WSL2 .wslconfig에서 디스크 할당량 충분히 설정 (권장: 50GB 이상)
```

---

### 1.2 .env 파일 없음

```
에러 메시지:
  Error: Missing environment variable: DATABASE_URL
  또는: Cannot find module '../.env'
  또는: TypeError: Cannot read properties of undefined (reading 'split')

원인:
  .env 파일이 .gitignore에 포함되어 있어 저장소에 존재하지 않음
  신규 팀원이 .env를 생성하지 않고 서비스 실행 시도

해결:
  # 1. .env.example 파일 확인 (팀이 제공하는 템플릿)
  cat .env.example

  # 2. .env 파일 복사 및 실제 값 입력
  cp .env.example .env
  # 편집기로 열어 DATABASE_URL, JWT_SECRET 등 실제 값 입력
  vi .env

  # 3. 팀 Slack/노션에서 개발 환경 시크릿 값 요청
  # (시크릿 값은 절대 이메일/채팅으로 공유 금지, Vault 또는 1Password 사용)

  # 4. 모든 필수 환경 변수 설정 확인
  node -e "require('dotenv').config(); console.log(process.env.DATABASE_URL)"

주의:
  .env 파일을 절대 git에 커밋하지 마십시오 (CSAP 위반, 시크릿 노출)
  git add .env 입력 시 pre-commit 훅이 자동으로 차단합니다

예방:
  .env.example을 항상 최신 상태로 유지하고
  새로운 환경 변수 추가 시 .env.example에도 반드시 반영
```

---

### 1.3 TypeScript 컴파일 오류

#### 오류 유형 A — 타입 불일치

```
에러 메시지:
  error TS2322: Type 'string | undefined' is not assignable to type 'string'
  error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'

원인:
  TypeScript strict 모드에서 타입 검사가 엄격하게 동작
  이 프로젝트는 strict: true 설정으로 null/undefined 처리 필수

해결:
  # 컴파일 오류 전체 목록 확인
  npx tsc --noEmit 2>&1 | head -50

  코드 수정 예시:
  // 잘못된 예
  const name: string = user.name   // user.name이 string | undefined 일 때

  // 올바른 예 (nullish coalescing)
  const name: string = user.name ?? '이름 없음'

  // 올바른 예 (타입 가드)
  if (user.name !== undefined) {
    const name: string = user.name   // 이 블록에서는 string으로 확정
  }

예방: IDE에서 TypeScript 에러를 실시간으로 확인 (VS Code + TypeScript 플러그인)
     저장 시 자동 컴파일 확인 설정: "typescript.tsdk": "node_modules/typescript/lib"
```

#### 오류 유형 B — 모듈 해석 오류

```
에러 메시지:
  error TS2307: Cannot find module '@public-saas/observability' or
               its corresponding type declarations
  error TS2307: Cannot find module '../types/user.js'

원인:
  A: 공유 패키지가 빌드되지 않았거나 설치되지 않음
  B: import 경로에 .js 확장자 누락 (ESM 프로젝트)

해결 A:
  # 공유 패키지 재빌드
  cd /data/ai-saas
  pnpm --filter '@public-saas/observability' build

  # 또는 전체 빌드
  pnpm build

해결 B:
  // 잘못된 예 (ESM에서 .js 필수)
  import { UserService } from '../services/user'

  // 올바른 예
  import { UserService } from '../services/user.js'

예방: tsconfig.json의 moduleResolution: "bundler" 또는 "node16" 확인
     자동 import에서 .js 확장자가 붙도록 IDE 설정
```

#### 오류 유형 C — 빌드 캐시 오류

```
에러 메시지:
  error TS6307: File ... was referenced by its alias...
  또는 갑자기 이전에 없던 에러 대량 발생

원인:
  TypeScript 증분 빌드 캐시(*.tsbuildinfo)가 손상됨

해결:
  # 캐시 파일 삭제 후 클린 빌드
  find /data/ai-saas -name "*.tsbuildinfo" -delete
  find /data/ai-saas -name "dist" -type d -not -path "*/node_modules/*" | xargs rm -rf
  pnpm build

예방: 브랜치 전환 후 빌드 오류 시 클린 빌드 시도
```

---

### 1.4 Prisma migrate 실패

#### 오류 유형 A — 데이터베이스 연결 실패

```
에러 메시지:
  Error: P1001: Can't reach database server at `localhost`:`5432`
  또는: ECONNREFUSED 127.0.0.1:5432

원인:
  PostgreSQL 서비스가 실행되지 않았거나
  DATABASE_URL 환경 변수가 잘못 설정됨

해결:
  # 1. 환경 변수 확인
  echo $DATABASE_URL
  # postgresql://user:pass@localhost:5432/saasdb 형식이어야 함

  # 2. Docker로 PostgreSQL 실행 중인지 확인
  docker ps | grep postgres

  # 3. k3s 환경에서는 포트 포워딩
  kubectl port-forward svc/postgresql 5432:5432 -n saas-platform &

  # 4. 연결 테스트
  psql $DATABASE_URL -c "SELECT 1"

예방: 개발 환경 docker-compose.yml로 DB 포함 전체 스택 실행
  docker compose up -d
```

#### 오류 유형 B — 마이그레이션 충돌

```
에러 메시지:
  Error: P3006: Migration failed to apply cleanly to the shadow database.
  Error: Column 'email' already exists

원인:
  이미 적용된 마이그레이션과 현재 스키마 충돌
  DB에 직접 스키마를 변경한 후 Prisma 마이그레이션 생성 시

해결:
  # 1. 현재 마이그레이션 상태 확인
  npx prisma migrate status

  # 2. 개발 환경에서만 — 리셋 (데이터 삭제 주의!)
  npx prisma migrate reset
  # "Are you sure?" 에 y 입력

  # 3. 특정 마이그레이션이 실제로 적용됐다고 표시
  npx prisma migrate resolve --applied "20260401000000_init"

주의: migrate reset은 개발 DB에서만 사용
     스테이징/프로덕션 DB에서 절대 금지

예방: DB 스키마를 직접 수정하지 말 것
     항상 prisma/schema.prisma 수정 → prisma migrate dev 순서 준수
```

---

## 2. k3s / Kubernetes 오류

### 2.1 CrashLoopBackOff

```
증상:
  kubectl get pods -n saas-platform
  NAME                      READY   STATUS             RESTARTS   AGE
  auth-service-xxx          0/1     CrashLoopBackOff   5          10m

원인: 컨테이너가 시작했다가 즉시 종료되는 상황이 반복됨
  주요 원인 5가지:
  A. 필수 환경 변수 누락 (DATABASE_URL, JWT_SECRET 등)
  B. 외부 서비스 연결 실패 (DB, Redis가 준비되지 않음)
  C. OOM Killed (메모리 한도 초과)
  D. 코드 버그로 인한 즉시 종료 (uncaught exception)
  E. 이미지 설정 오류 (CMD/ENTRYPOINT 잘못됨)
```

**진단 단계:**

```bash
# 1단계: Pod 상태 요약 확인
kubectl describe pod <pod-name> -n saas-platform

# 출력에서 확인할 부분:
# Last State: OOMKilled / Error / Completed
# Exit Code: 0 (정상 종료), 1 (오류), 137 (OOM Kill), 143 (SIGTERM)

# 2단계: 이전 컨테이너 로그 확인 (현재 시작 중인 것이 아님)
kubectl logs <pod-name> -n saas-platform --previous

# 3단계: 이벤트 확인
kubectl get events -n saas-platform --sort-by='.lastTimestamp' | grep <pod-name>
```

**원인별 해결:**

```bash
# A. 환경 변수 누락
kubectl describe pod <pod-name> -n saas-platform | grep -A5 "Environment"
# 누락된 변수 → ConfigMap 또는 Secret에 추가 후 롤아웃 재시작

# B. 외부 서비스 연결 실패
# 로그에서 확인: "connection refused", "ECONNREFUSED"
# DB가 준비될 때까지 기다리는 init container 설정 필요

# C. OOMKilled → §2.5 참조

# D. 코드 버그
kubectl logs <pod-name> --previous | tail -30
# 에러 스택 트레이스 확인 → 코드 수정 후 재배포

# E. 이미지 CMD 오류
# Dockerfile CMD 또는 Kubernetes command 설정 확인
kubectl get pod <pod-name> -n saas-platform -o yaml | grep -A10 "command:"
```

---

### 2.2 ImagePullBackOff

```
증상:
  NAME                    READY   STATUS             RESTARTS   AGE
  auth-service-xxx        0/1     ImagePullBackOff   0          5m

원인:
  A. 레지스트리 인증 실패 (Harbor 자격 증명 없음)
  B. 이미지 태그가 존재하지 않음 (오타 또는 미빌드)
  C. 레지스트리 서버 자체 접근 불가
```

**진단:**

```bash
# 오류 상세 확인
kubectl describe pod <pod-name> -n saas-platform | grep -A10 "Events"
# 예: Failed to pull image: unauthorized: authentication required
#     또는: not found: manifest unknown

# 현재 이미지 태그 확인
kubectl get pod <pod-name> -n saas-platform -o jsonpath='{.spec.containers[0].image}'
# 출력: localhost:8080/public-saas/auth-service:v1.2.3
```

**해결:**

```bash
# A. 레지스트리 인증 오류
# Harbor 이미지 풀 시크릿 확인
kubectl get secret harbor-credentials -n saas-platform

# 시크릿이 없으면 생성
kubectl create secret docker-registry harbor-credentials \
  --docker-server=localhost:8080 \
  --docker-username=<harbor-user> \
  --docker-password=<harbor-pass> \
  -n saas-platform

# Pod spec에 imagePullSecrets 설정 확인
kubectl get deployment <name> -n saas-platform -o yaml | grep imagePullSecrets

# B. 이미지 태그 없음
# CI/CD 파이프라인이 해당 태그를 빌드하고 Push했는지 확인
# Harbor UI 또는 CLI로 확인
curl -u user:pass http://localhost:8080/v2/public-saas/auth-service/tags/list

# C. 레지스트리 접근 불가
kubectl exec -n saas-platform <other-pod> -- \
  wget -qO- http://localhost:8080/v2/
```

---

### 2.3 서비스 접근 불가 (Ingress / DNS)

```
증상:
  브라우저에서 https://api.saas.local 접속 시 502 Bad Gateway
  또는 curl http://api.saas.local → connection refused
  또는 클러스터 내부에서 http://auth-service:3001 → 응답 없음
```

**진단 단계:**

```bash
# 1. 서비스가 정상인지 확인
kubectl get svc -n saas-platform | grep auth-service
# CLUSTER-IP가 <none>이면 Headless Service (의도된 경우 외에는 문제)

# 2. Endpoint(실제 Pod) 연결 확인
kubectl get endpoints auth-service -n saas-platform
# 출력: 10.42.1.5:3001  ← Pod IP가 보여야 함
# 출력: <none>          ← Pod 셀렉터가 일치하지 않음

# 3. Ingress 설정 확인
kubectl get ingress -n saas-platform
kubectl describe ingress <ingress-name> -n saas-platform

# 4. Traefik IngressRoute 확인 (이 프로젝트에서 사용)
kubectl get ingressroute -n saas-platform

# 5. 클러스터 내부 DNS 확인
kubectl run dns-test --image=busybox --rm -it -n saas-platform --restart=Never -- \
  nslookup auth-service.saas-platform.svc.cluster.local
```

**해결:**

```bash
# Endpoint가 없으면: Deployment의 label과 Service의 selector 일치 여부 확인
kubectl get deployment auth-service -n saas-platform -o yaml | grep -A3 "labels:"
kubectl get svc auth-service -n saas-platform -o yaml | grep -A3 "selector:"
# app: auth-service 가 동일해야 함

# Traefik Pod 상태 확인
kubectl get pods -n kube-system | grep traefik

# 인증서 오류 (HTTPS) 확인
kubectl get certificate -n saas-platform
```

---

### 2.4 PVC Pending

```
증상:
  kubectl get pvc -n saas-platform
  NAME               STATUS    VOLUME   CAPACITY   STORAGECLASS   AGE
  postgres-data      Pending   -        -          local-path     10m

원인:
  A. StorageClass가 없거나 이름이 다름
  B. 클러스터에 가용 노드가 없음
  C. 로컬 볼륨 경로가 존재하지 않음
```

**진단:**

```bash
# 1. StorageClass 목록 확인
kubectl get storageclass
# local-path 또는 longhorn 이 있어야 함

# 2. PVC 상세 이벤트
kubectl describe pvc postgres-data -n saas-platform
# Events: no nodes matched node selector 또는
#         storageclass "xxx" not found

# 3. k3s 기본 StorageClass 확인
kubectl get storageclass local-path -o yaml
```

**해결:**

```bash
# A. StorageClass 이름 불일치
# PVC의 storageClassName을 실제 존재하는 이름으로 수정
kubectl patch pvc postgres-data -n saas-platform \
  -p '{"spec":{"storageClassName":"local-path"}}'

# 또는 Helm values.yaml에서 storageClass 값 수정 후 재배포

# B. local-path provisioner 미설치 (k3s는 기본 포함)
kubectl get pods -n kube-system | grep local-path
# 없으면 설치:
kubectl apply -f https://raw.githubusercontent.com/rancher/local-path-provisioner/...
```

---

### 2.5 OOMKilled

```
증상:
  kubectl get pods -n saas-platform
  NAME              READY   STATUS      RESTARTS   AGE
  user-service-xxx  0/1     OOMKilled   3          20m

  또는 CrashLoopBackOff인데 Exit Code가 137

원인:
  컨테이너가 메모리 limit을 초과하여 커널이 강제 종료
  메모리 누수 또는 limit 설정이 너무 낮음
```

**진단:**

```bash
# Exit Code 137 = OOM Kill 확인
kubectl describe pod <pod-name> -n saas-platform | grep -A3 "Last State"
# Last State: Terminated
#   Reason: OOMKilled
#   Exit Code: 137

# 현재 메모리 limit 확인
kubectl get pod <pod-name> -n saas-platform -o yaml | grep -A4 "resources:"
# limits:
#   memory: 256Mi   ← 너무 낮을 수 있음

# 실시간 메모리 사용량 (metrics-server 필요)
kubectl top pods -n saas-platform | grep user-service
```

**해결:**

```bash
# 단기 해결: 메모리 limit 일시 증가 (Git을 통해 Helm values 수정 권장)
# Helm values.yaml에서:
# resources:
#   limits:
#     memory: 512Mi  ← 기존 256Mi에서 증가

# Git push → Flux 자동 재배포

# 근본 해결: 메모리 누수 진단
# 서비스 로그에서 메모리 패턴 확인
kubectl logs <pod-name> -n saas-platform | grep -i "heap\|memory\|oom"

# Node.js 힙 메모리 프로파일링 (개발 환경)
NODE_OPTIONS="--max-old-space-size=256 --expose-gc" node dist/main.js
```

---

## 3. CI/CD 오류

### 3.1 Lint 단계 실패

```
증상:
  파이프라인 로그:
  [LINT] Running ESLint...
  /data/ai-saas/platform/services/auth-service/src/routes.ts
    Line 45:5  error  Unexpected console statement  no-console
    Line 67:3  error  'unusedVar' is assigned a value but never used  no-unused-vars
  ✖ 2 problems (2 errors, 0 warnings)
  [LINT] FAILED
```

**원인과 해결:**

```bash
# 로컬에서 먼저 lint 실행 (파이프라인 전 확인 필수)
pnpm lint

# 자동 수정 가능한 오류 일괄 수정
pnpm lint --fix

# 특정 파일만 확인
npx eslint platform/services/auth-service/src/routes.ts

# 자주 발생하는 오류:
# 1. console.log 사용 → 구조화 로거로 교체
#    import { logger } from '@public-saas/observability'
#    logger.info('메시지')  ← console.log 대신

# 2. 미사용 변수 → 삭제하거나 _ 접두사 (의도적 미사용 시)
#    const _unusedButRequired = ...

# 3. any 타입 사용 → 구체적 타입으로 교체
#    const data: unknown = response   ← any 대신 unknown

예방: Git pre-commit 훅이 자동으로 lint 실행
     (commit 시도 전 로컬 lint 통과 확인)
```

---

### 3.2 Docker 빌드 실패

```
증상:
  파이프라인 로그:
  #12 [7/8] RUN pnpm build
  #12 ERROR: process "/bin/sh -c pnpm build" did not complete successfully
  exit code: 1
  또는:
  #8 [5/8] COPY --from=base /data/ai-saas/pnpm-lock.yaml .
  ERROR: failed to solve: failed to read dockerfile: ...
```

**진단과 해결:**

```bash
# 로컬에서 동일 빌드 재현
docker build -t test-build -f platform/services/auth-service/Dockerfile .

# 빌드 단계별 오류 확인
docker build --progress=plain -t test-build \
  -f platform/services/auth-service/Dockerfile . 2>&1 | head -100

# 자주 발생하는 원인:
# A. pnpm 빌드 실패 → TypeScript 컴파일 오류
#    로컬에서 pnpm build 실행 후 확인

# B. .dockerignore 누락 파일
#    .dockerignore 내용 확인
cat platform/services/auth-service/.dockerignore

# C. 멀티스테이지 빌드에서 경로 오류
#    Dockerfile의 COPY 경로 확인 (모노레포 루트 기준)

# D. 기반 이미지 없음 (내부망에서 Docker Hub 차단)
#    FROM 이미지를 Harbor 미러로 변경
#    FROM localhost:8080/library/node:22-alpine
```

---

### 3.3 Helm 배포 실패

```
증상:
  파이프라인 로그:
  Error: UPGRADE FAILED: another operation (install/upgrade/rollback)
         is in progress
  또는:
  Error: rendered manifests contain a resource that already exists
  또는:
  Error: chart requires kubeVersion: >=1.29.0 which is incompatible with ...
```

**해결:**

```bash
# A. 다른 배포 진행 중
# 현재 배포 상태 확인
helm history auth-service -n saas-platform

# 실패한 배포 롤백
helm rollback auth-service -n saas-platform

# 또는 강제 초기화 (주의: 서비스 중단 가능)
helm delete auth-service -n saas-platform
helm install auth-service ./infra/helm/... -n saas-platform

# B. 리소스 충돌
kubectl get all -n saas-platform | grep auth-service
# 수동으로 생성된 리소스가 있으면 삭제 후 재배포

# C. k3s 버전 확인
kubectl version --client
# 1.29 미만이면 k3s 업그레이드 필요

예방: Flux를 통한 GitOps 배포 시 이런 충돌이 자동으로 해결됨
     직접 helm install/upgrade 대신 Git push → Flux 배포 사용
```

---

### 3.4 Q-Gate 실패

Q-Gate는 7단계 품질 게이트입니다. 어느 게이트에서 실패했는지 파이프라인 로그에서 확인합니다.

| 게이트 | 설명 | 실패 시 원인 |
|--------|------|------------|
| G1 | 요구사항 FR ID 전수 | Plan 문서 누락 |
| G2 | 설계 완전성 | Design 문서 누락 또는 불완전 |
| G3 | 코드 품질 + AgentShield | ESLint 오류, 보안 취약점 |
| G4 | 테스트 커버리지 80%+ | 테스트 케이스 부족 |
| G5 | OWASP Top10 | 보안 취약점 발견 |
| G6 | CSAP 해당 Phase 100% | CSAP 통제항목 미구현 |
| G7 | 감사 추적 완비 | audit.jsonl 기록 누락 |

```bash
# G3 실패 (가장 흔함) — 코드 품질 게이트
pnpm lint            # ESLint 통과 확인
npx tsc --noEmit     # TypeScript 컴파일 확인

# G4 실패 — 테스트 커버리지
pnpm test --coverage
# Coverage: 75.3%  ← 80% 미달이면 실패
# 부족한 부분 테스트 추가 후 재실행

# G5 실패 — OWASP 보안 스캔
npx semgrep --config auto platform/services/auth-service/src/
# 발견된 취약점 수정 후 재실행

# G7 실패 — 감사 로그 누락
# 민감 작업(delete, create user 등)에 auditLog() 호출 추가
# platform/services/compliance-service/src/lib/audit.ts 패턴 참조
```

---

## 4. 보안 / 인증 오류

### 4.1 JWT 토큰 만료

```
에러 메시지:
  {"error": "TokenExpiredError", "message": "jwt expired"}
  또는 HTTP 401 {"code": "TOKEN_EXPIRED"}

원인:
  액세스 토큰 유효 기간(15분) 초과
  리프레시 토큰도 만료 (7일)
  또는 서버의 JWT_SECRET이 변경됨

해결 (클라이언트 측):
  // 1. 리프레시 토큰으로 새 액세스 토큰 요청
  const response = await fetch('/auth/refresh', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${refreshToken}` },
  })

  // 2. 리프레시 토큰도 만료 시 → 재로그인 필요
  if (response.status === 401) {
    redirectToLogin()
  }

해결 (서버 측):
  # JWT_SECRET 환경 변수 확인
  kubectl get secret auth-secrets -n saas-platform -o yaml | \
    grep JWT_SECRET | base64 -d

  # JWT 토큰 수동 디코드 (페이로드 확인)
  # jwt.io 사이트 또는:
  echo "<토큰>" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq

예방:
  - 액세스 토큰: 15분, 리프레시 토큰: 7일 정책 준수
  - 클라이언트에서 토큰 만료 전 자동 갱신 구현 (토큰 만료 1분 전)
```

---

### 4.2 401 Unauthorized vs 403 Forbidden

두 오류는 다른 의미이므로 구분해서 처리해야 합니다.

| 상태 | 의미 | 원인 | 해결 |
|------|------|------|------|
| `401 Unauthorized` | 인증되지 않음 | 토큰 없음, 만료, 서명 오류 | 재로그인 또는 토큰 갱신 |
| `403 Forbidden` | 인가 거부 | 권한 부족 (RBAC) | 역할 부여 또는 다른 계정 사용 |

```bash
# 401 진단
# Authorization 헤더가 제대로 전송되는지 확인
curl -v http://api.saas.local/api/v1/users \
  -H "Authorization: Bearer <token>" 2>&1 | grep "< HTTP"

# 토큰 유효성 직접 확인
curl http://api.saas.local/auth/verify \
  -H "Authorization: Bearer <token>"
# 응답: {"valid": true, "userId": "..."} 또는 {"error": "TokenExpiredError"}

# 403 진단
# 사용자의 현재 역할 확인
curl http://api.saas.local/api/v1/me \
  -H "Authorization: Bearer <token>"
# {"role": "viewer"}  ← admin 권한이 필요한데 viewer인 경우

# 역할 변경 (관리자가 수행)
curl -X PATCH http://api.saas.local/api/v1/users/<userId>/role \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

**CSAP 준수 — 403 발생 시 반드시 감사 로그 기록:**

```typescript
// 올바른 403 응답 패턴 (CSAP D-08)
export async function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await verifyToken(request)

    if (!hasPermission(user, permission)) {
      // 감사 로그 기록 필수 (CSAP D-06)
      await auditLog({
        actor: user.id,
        action: 'ACCESS_DENIED',
        target: request.url,
        reason: `permission_required: ${permission}`,
        ip: request.ip,
      })

      return reply.code(403).send({
        error: 'Forbidden',
        message: '권한이 부족합니다',
      })
    }
  }
}
```

---

### 4.3 CSAP 감사 로그 누락

```
증상:
  Q-Gate G7 실패: "감사 추적 audit.jsonl 미완비"
  또는 감리 시 민감 작업에 대한 감사 로그 없음

원인:
  민감 작업(사용자 삭제, 권한 변경, 데이터 내보내기 등)에
  auditLog() 호출이 누락됨

CSAP D-06 요구사항:
  - 모든 민감 작업에 감사 로그 필수
  - 로그 보존: 최소 1년
  - 로그 무결성: append-only (수정/삭제 불가)
```

**해결 — 감사 로그 추가:**

```typescript
// platform/services/compliance-service/src/lib/audit.ts 패턴 참조
import { auditLog } from '../lib/audit.js'

// 사용자 삭제 예시 — auditLog 필수
async function deleteUser(adminUser: User, targetUserId: string): Promise<void> {
  // 1. 감사 로그 먼저 기록 (작업 전 기록 원칙)
  await auditLog({
    actor: adminUser.id,
    action: 'USER_DELETE',
    target: targetUserId,
    timestamp: new Date().toISOString(),
    ip: getClientIP(),
    metadata: {
      reason: 'admin_request',
      targetEmail: targetUser.email,  // PII 마스킹 후 기록
    },
  })

  // 2. 실제 작업 수행
  await prisma.user.delete({ where: { id: targetUserId } })
}

// 감사 로그가 필요한 민감 작업 목록:
// - 사용자 생성/수정/삭제
// - 권한 변경
// - 로그인/로그아웃
// - 데이터 내보내기/다운로드
// - 설정 변경
// - 결제 처리
```

**감사 로그 누락 여부 확인:**

```bash
# audit.jsonl 마지막 항목 확인
tail -5 /data/ai-saas/.claude/audit.jsonl | jq

# 특정 작업 감사 로그 검색
grep '"action":"USER_DELETE"' /data/ai-saas/.claude/audit.jsonl | jq
```

---

## 5. 모니터링 오류

### 5.1 Prometheus 타겟 다운

```
증상:
  Prometheus UI (http://localhost:9090/targets) 접속 시
  auth-service 타겟이 DOWN 상태
  또는 State: DOWN, Last Error: connection refused

원인:
  A. 서비스가 /metrics 엔드포인트를 노출하지 않음
  B. Prometheus가 서비스를 찾지 못함 (서비스 디스커버리 설정 오류)
  C. 서비스 자체가 다운됨
  D. 방화벽/NetworkPolicy 차단
```

**진단:**

```bash
# 1. /metrics 엔드포인트 직접 확인
kubectl exec -n saas-platform <any-pod> -- \
  wget -qO- http://auth-service.saas-platform.svc.cluster.local:3001/metrics

# 정상이면: # HELP http_requests_total ... 출력
# 비정상이면: connection refused 또는 404

# 2. Prometheus ServiceMonitor 확인
kubectl get servicemonitor -n monitoring
kubectl describe servicemonitor auth-service -n monitoring

# 3. Prometheus 설정에서 타겟 확인
kubectl port-forward svc/prometheus-server 9090:9090 -n monitoring
# 브라우저: http://localhost:9090/targets

# 4. Pod annotation 확인 (annotation 기반 디스커버리 시)
kubectl get pod <pod-name> -n saas-platform -o yaml | grep -A5 "annotations:"
# prometheus.io/scrape: "true"
# prometheus.io/port: "3001"
# prometheus.io/path: "/metrics"
```

**해결:**

```typescript
// 서비스에 /metrics 엔드포인트 추가
import { register } from 'prom-client'

app.get('/metrics', async (request, reply) => {
  reply.header('Content-Type', register.contentType)
  return register.metrics()
})
```

---

### 5.2 Grafana 대시보드 데이터 없음

```
증상:
  Grafana 대시보드의 패널이 "No data"
  또는 그래프가 비어 있음
  또는 "metric not found" 오류

원인:
  A. 데이터 소스 연결 오류
  B. 시간 범위 설정 오류 (데이터가 있는 시간대가 아님)
  C. PromQL 쿼리 오류
  D. Prometheus 타겟이 다운 (§5.1 참조)
  E. Grafana 데이터 소스 설정 잘못됨
```

**진단:**

```bash
# Grafana 접속
kubectl port-forward -n monitoring svc/grafana 3000:3000

# 1. Configuration → Data Sources → Prometheus → Test
#    "Data source is working" 메시지 확인

# 2. Explore 모드에서 직접 쿼리 실행
#    Explore → Prometheus → 메트릭 이름 입력 → Run Query

# 3. 메트릭 존재 확인
curl http://localhost:9090/api/v1/label/__name__/values | \
  jq '.data | map(select(startswith("http_")))' | head -10

# 4. 시간 범위 확인
#    대시보드 우측 상단 시간 범위를 "Last 1 hour"로 변경
```

**해결:**

```bash
# 데이터 소스 URL 재설정
# Grafana → Configuration → Data Sources → Prometheus
# URL: http://prometheus-server.monitoring.svc.cluster.local:9090

# 대시보드 새로고침 간격 설정
# 대시보드 설정 → Auto refresh: 10s
```

---

### 5.3 알림 미발송

```
증상:
  AlertManager UI에서 알림이 Firing 상태인데
  Slack/이메일로 알림이 오지 않음

원인:
  A. AlertManager의 수신자 설정 오류 (Slack webhook URL 만료)
  B. Silence 규칙이 적용되어 알림이 음소거됨
  C. 라우팅 규칙이 잘못 설정됨
  D. 네트워크 차단 (내부망에서 Slack API 접근 불가)
```

**진단:**

```bash
# AlertManager 접속
kubectl port-forward -n monitoring svc/alertmanager 9093:9093

# 1. Silences 탭에서 음소거 규칙 확인
#    만료되지 않은 Silence가 있으면 해당 알림이 차단됨

# 2. Status 탭에서 설정 확인
#    receivers 항목의 slack webhook URL 확인

# 3. AlertManager 로그 확인
kubectl logs -n monitoring -l app=alertmanager --tail=50
# "sending notification to Slack" 메시지 검색
# 또는 "failed to send" 에러 확인

# 4. 직접 테스트 알림 발송
curl -X POST http://localhost:9093/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '[{"labels":{"alertname":"TestAlert","severity":"critical"}}]'
```

**해결:**

```bash
# Slack Webhook URL 갱신
# AlertManager ConfigMap 수정
kubectl edit configmap alertmanager-config -n monitoring
# slack_api_url: https://hooks.slack.com/services/... ← 새 URL

# 수정 후 AlertManager 재시작
kubectl rollout restart deployment/alertmanager -n monitoring

# Silence 삭제 (알림이 무음 처리된 경우)
# AlertManager UI → Silences → 해당 Silence → Expire
```

---

## 관련 문서

- [2절 디버깅 방법론](02-debugging-guide.md) — kubectl 심화, k9s, stern 활용
- [3절 성능 최적화](03-performance-guide.md) — 병목 찾기, 프로파일링
- [5장 모니터링 — Prometheus 기초](../05-monitoring/metrics/01-prometheus-basics.md)
- [5장 모니터링 — 분산 추적](../05-monitoring/tracing/01-tempo-otel.md)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.1.0 | 2026-04-12 | .env 오류, Ingress, Q-Gate 상세 추가, 결정 트리 추가 | Implementer (Sonnet) |
| 1.0.0 | 2026-04-11 | 초안 작성 | Implementer (Sonnet) |
