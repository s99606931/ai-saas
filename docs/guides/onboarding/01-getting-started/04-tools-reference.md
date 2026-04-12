# CLI 도구 레퍼런스 — 공공기관 SaaS 프레임워크

> **문서 ID**: ONBOARD-01-04
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **학습 대상**: 개발 환경 설정 완료 후 도구 숙지가 필요한 팀원
> **선행 문서**: `02-environment-setup.md`
> **예상 소요 시간**: 1~2시간 (숙지 및 실습)

---

## 목차

1. [개발 도구](#1-개발-도구)
   - 1.1 pnpm 주요 명령어
   - 1.2 turbo 명령어
   - 1.3 prisma 명령어
   - 1.4 TypeScript tsc
2. [Kubernetes / 인프라 도구](#2-kubernetes--인프라-도구)
   - 2.1 kubectl 핵심 명령어 50개
   - 2.2 helm 명령어
   - 2.3 flux 명령어
   - 2.4 k9s TUI 단축키
   - 2.5 stern 명령어
   - 2.6 linkerd 명령어
3. [보안 도구](#3-보안-도구)
   - 3.1 semgrep 로컬 실행
   - 3.2 trivy 이미지/파일 스캔
   - 3.3 cosign 서명/검증
   - 3.4 vault CLI
4. [Claude Code](#4-claude-code)
   - 4.1 claude 명령어
   - 4.2 슬래시 커맨드
5. [빠른 참조 카드](#5-빠른-참조-카드)
6. [변경 이력](#6-변경-이력)

---

## 1. 개발 도구

### 1.1 pnpm 주요 명령어

pnpm은 이 프로젝트의 표준 패키지 관리자입니다. npm이나 yarn 명령어를 사용하면 `pnpm-lock.yaml`과 충돌이 발생합니다.

#### 기본 명령어

| 명령 | 설명 | 예시 |
|------|------|------|
| `pnpm install` | 모든 워크스페이스 의존성 설치 | `pnpm install` |
| `pnpm install --frozen-lockfile` | lockfile 변경 없이 설치 (CI에서 사용) | `pnpm install --frozen-lockfile` |
| `pnpm add <패키지>` | 현재 패키지에 의존성 추가 | `pnpm add zod` |
| `pnpm add -D <패키지>` | devDependency로 추가 | `pnpm add -D vitest` |
| `pnpm add -w <패키지>` | 루트 워크스페이스에 추가 | `pnpm add -w turbo` |
| `pnpm remove <패키지>` | 의존성 제거 | `pnpm remove lodash` |
| `pnpm update <패키지>` | 패키지 업데이트 | `pnpm update zod` |
| `pnpm update --latest` | 모든 패키지 최신 버전으로 업데이트 | `pnpm update --latest` |
| `pnpm outdated` | 오래된 패키지 목록 확인 | `pnpm outdated` |
| `pnpm audit` | 보안 취약점 스캔 | `pnpm audit` |
| `pnpm audit --fix` | 자동 수정 가능한 취약점 수정 | `pnpm audit --fix` |

#### 실행 명령어

| 명령 | 설명 | 예시 |
|------|------|------|
| `pnpm run <스크립트>` | 현재 패키지의 스크립트 실행 | `pnpm run build` |
| `pnpm <스크립트>` | run 생략 가능 (편의) | `pnpm build` |
| `pnpm dev` | 개발 서버 시작 | `pnpm dev` |
| `pnpm build` | 전체 빌드 (Turbo 사용) | `pnpm build` |
| `pnpm test` | 전체 테스트 실행 | `pnpm test` |
| `pnpm test:coverage` | 커버리지 포함 테스트 | `pnpm test:coverage` |
| `pnpm lint` | 린트 검사 | `pnpm lint` |
| `pnpm typecheck` | TypeScript 타입 검사 | `pnpm typecheck` |
| `pnpm clean` | 빌드 아티팩트 제거 | `pnpm clean` |

#### 워크스페이스 명령어 (모노레포 핵심)

| 명령 | 설명 | 예시 |
|------|------|------|
| `pnpm --filter <패키지> <명령>` | 특정 패키지에서만 실행 | `pnpm --filter @public-saas/auth-service dev` |
| `pnpm --filter ...<패키지>` | 패키지와 그 의존성 모두 실행 | `pnpm --filter ...@public-saas/auth-service build` |
| `pnpm --filter <패키지>...` | 패키지와 그에 의존하는 모든 패키지 실행 | `pnpm --filter @public-saas/crypto... test` |
| `pnpm --filter "./packages/*" <명령>` | 특정 디렉토리의 패키지 모두 실행 | `pnpm --filter "./packages/*" build` |
| `pnpm -r <명령>` | 모든 워크스페이스에서 재귀 실행 | `pnpm -r build` |
| `pnpm -r --parallel <명령>` | 병렬로 재귀 실행 | `pnpm -r --parallel test` |
| `pnpm exec <명령>` | 현재 패키지의 node_modules/.bin 실행 | `pnpm exec tsc --version` |
| `pnpm dlx <패키지>` | 설치 없이 패키지 즉시 실행 | `pnpm dlx create-next-app` |
| `pnpm store path` | pnpm 저장소 경로 확인 | `pnpm store path` |
| `pnpm store prune` | 사용하지 않는 패키지 정리 | `pnpm store prune` |

#### 자주 사용하는 조합

```bash
# 특정 서비스만 개발 모드로 실행
pnpm --filter @public-saas/ai-service dev

# 특정 서비스 테스트 + 커버리지
pnpm --filter @public-saas/auth-service test:coverage

# 모든 서비스 빌드 (Turbo 캐싱 활용)
pnpm build

# 변경된 패키지만 빌드 (Turbo --affected)
pnpm build --affected

# 공통 패키지 타입 재생성 후 전체 빌드
pnpm --filter @public-saas/db generate && pnpm build
```

---

### 1.2 turbo 명령어

Turbo는 모노레포의 빌드 파이프라인을 가속하는 도구입니다. 변경되지 않은 패키지는 캐시에서 즉시 복원합니다.

| 명령 | 설명 | 예시 |
|------|------|------|
| `turbo run build` | 의존성 순서에 맞게 전체 빌드 | `turbo run build` |
| `turbo run build --filter=<패키지>` | 특정 패키지만 빌드 | `turbo run build --filter=@public-saas/auth-service` |
| `turbo run build --affected` | 변경된 패키지만 빌드 | `turbo run build --affected` |
| `turbo run lint` | 전체 린트 | `turbo run lint` |
| `turbo run test` | 전체 테스트 | `turbo run test` |
| `turbo run test:coverage` | 전체 테스트 + 커버리지 | `turbo run test:coverage` |
| `turbo run typecheck` | 전체 타입 검사 | `turbo run typecheck` |
| `turbo run --dry-run` | 실행할 작업만 미리 보기 | `turbo run build --dry-run` |
| `turbo run --graph` | 작업 의존성 그래프 출력 | `turbo run build --graph` |
| `turbo daemon start` | Turbo 데몬 시작 (캐싱 속도 향상) | `turbo daemon start` |
| `turbo daemon stop` | Turbo 데몬 중지 | `turbo daemon stop` |

```bash
# 실전 예시: 특정 서비스와 그 의존 패키지만 빌드
turbo run build --filter=@public-saas/api-gateway...

# 빌드 캐시 초기화 (예상치 못한 빌드 오류 시)
turbo run build --force
```

---

### 1.3 prisma 명령어

Prisma는 이 프로젝트의 ORM입니다. PostgreSQL 스키마를 TypeScript 타입으로 자동 생성합니다.

| 명령 | 설명 | 예시 |
|------|------|------|
| `prisma generate` | TypeScript 클라이언트 코드 생성 | `pnpm --filter @public-saas/db exec prisma generate` |
| `prisma migrate dev` | 개발 환경 마이그레이션 (로컬 DB 수정) | `prisma migrate dev --name add_user_table` |
| `prisma migrate dev --create-only` | SQL 파일만 생성 (실행은 나중에) | `prisma migrate dev --create-only --name fix_index` |
| `prisma migrate deploy` | 운영 환경 마이그레이션 실행 | `prisma migrate deploy` |
| `prisma migrate status` | 마이그레이션 적용 상태 확인 | `prisma migrate status` |
| `prisma migrate reset` | DB 초기화 + 마이그레이션 재실행 (개발 전용!) | `prisma migrate reset` |
| `prisma db push` | 스키마를 DB에 직접 적용 (마이그레이션 파일 없음, 개발 전용) | `prisma db push` |
| `prisma db pull` | 기존 DB 스키마를 Prisma 스키마로 역방향 생성 | `prisma db pull` |
| `prisma db seed` | 초기 데이터 삽입 | `prisma db seed` |
| `prisma studio` | 웹 UI 데이터 탐색기 실행 | `prisma studio` |
| `prisma format` | schema.prisma 포맷 정리 | `prisma format` |
| `prisma validate` | schema.prisma 문법 검증 | `prisma validate` |

#### 자주 사용하는 Prisma 워크플로우

```bash
# 새 기능 개발 시 DB 스키마 변경 절차
# 1. schema.prisma 수정
# 2. 마이그레이션 파일 생성
pnpm --filter @public-saas/db exec prisma migrate dev --name 기능명

# 3. TypeScript 클라이언트 재생성
pnpm --filter @public-saas/db exec prisma generate

# 4. 빌드 확인
pnpm build

# 운영 배포 시 마이그레이션 적용
# (Dockerfile CMD 또는 Init Container에서 자동 실행)
prisma migrate deploy
```

> **주의**: `prisma migrate reset`은 데이터를 모두 삭제합니다. 개발 환경에서만 사용하십시오.

---

### 1.4 TypeScript tsc

| 명령 | 설명 | 예시 |
|------|------|------|
| `tsc` | tsconfig.json 기반 컴파일 | `pnpm exec tsc` |
| `tsc --noEmit` | 타입 검사만 (파일 생성 없음) | `pnpm exec tsc --noEmit` |
| `tsc --watch` | 변경 감지 후 자동 재컴파일 | `pnpm exec tsc --watch` |
| `tsc --version` | TypeScript 버전 확인 | `pnpm exec tsc --version` |
| `tsc --listFiles` | 컴파일되는 파일 목록 출력 | `pnpm exec tsc --listFiles` |
| `tsc --diagnostics` | 성능 진단 정보 출력 | `pnpm exec tsc --diagnostics` |
| `tsc --showConfig` | 적용되는 tsconfig 최종 설정 출력 | `pnpm exec tsc --showConfig` |

```bash
# 타입 오류만 확인 (가장 자주 사용)
pnpm typecheck  # 내부적으로 tsc --noEmit 실행

# 특정 서비스만 타입 검사
pnpm --filter @public-saas/ai-service typecheck
```

---

## 2. Kubernetes / 인프라 도구

### 2.1 kubectl 핵심 명령어 50개

kubectl은 Kubernetes 클러스터를 제어하는 핵심 CLI입니다.

#### 파드(Pod) 관련

| 명령 | 설명 | 예시 |
|------|------|------|
| `kubectl get pods` | 현재 네임스페이스의 파드 목록 | `kubectl get pods` |
| `kubectl get pods -n <네임스페이스>` | 특정 네임스페이스의 파드 | `kubectl get pods -n saas-prod` |
| `kubectl get pods --all-namespaces` | 모든 네임스페이스의 파드 | `kubectl get pods -A` |
| `kubectl get pods -o wide` | 파드 IP, 노드 포함 상세 목록 | `kubectl get pods -o wide` |
| `kubectl get pods -w` | 파드 상태 실시간 감시 | `kubectl get pods -w` |
| `kubectl describe pod <파드명>` | 파드 상세 정보 (이벤트 포함) | `kubectl describe pod auth-service-7d8f9c-xxx` |
| `kubectl logs <파드명>` | 파드 로그 출력 | `kubectl logs auth-service-7d8f9c-xxx` |
| `kubectl logs <파드명> -f` | 파드 로그 스트리밍 | `kubectl logs auth-service-7d8f9c-xxx -f` |
| `kubectl logs <파드명> --previous` | 이전 컨테이너의 로그 (충돌 후 분석) | `kubectl logs auth-service-xxx --previous` |
| `kubectl logs <파드명> -c <컨테이너>` | 특정 컨테이너 로그 (멀티 컨테이너) | `kubectl logs pod -c linkerd-proxy` |
| `kubectl exec -it <파드명> -- bash` | 파드 내부 셸 접속 | `kubectl exec -it auth-service-xxx -- bash` |
| `kubectl exec <파드명> -- <명령>` | 파드 내부에서 명령 실행 | `kubectl exec auth-service-xxx -- env` |
| `kubectl delete pod <파드명>` | 파드 삭제 (자동 재시작) | `kubectl delete pod auth-service-xxx` |
| `kubectl top pod` | 파드 CPU/메모리 사용량 | `kubectl top pod` |
| `kubectl top pod --sort-by=memory` | 메모리 사용량 순 정렬 | `kubectl top pod --sort-by=memory` |

#### 배포(Deployment) 관련

| 명령 | 설명 | 예시 |
|------|------|------|
| `kubectl get deployments` | 배포 목록 | `kubectl get deployments` |
| `kubectl describe deployment <이름>` | 배포 상세 정보 | `kubectl describe deployment auth-service` |
| `kubectl rollout status deployment/<이름>` | 배포 진행 상태 확인 | `kubectl rollout status deployment/auth-service` |
| `kubectl rollout history deployment/<이름>` | 배포 히스토리 | `kubectl rollout history deployment/auth-service` |
| `kubectl rollout undo deployment/<이름>` | 이전 버전으로 롤백 | `kubectl rollout undo deployment/auth-service` |
| `kubectl rollout undo deployment/<이름> --to-revision=2` | 특정 버전으로 롤백 | `kubectl rollout undo deployment/auth-service --to-revision=2` |
| `kubectl rollout restart deployment/<이름>` | 배포 재시작 (이미지 변경 없이) | `kubectl rollout restart deployment/auth-service` |
| `kubectl scale deployment/<이름> --replicas=3` | 레플리카 수 조정 | `kubectl scale deployment/auth-service --replicas=3` |
| `kubectl set image deployment/<이름> <컨테이너>=<이미지>` | 이미지 업데이트 | `kubectl set image deployment/auth-service app=harbor.local/auth:v1.2` |

#### 서비스/인그레스 관련

| 명령 | 설명 | 예시 |
|------|------|------|
| `kubectl get services` | 서비스 목록 | `kubectl get svc` |
| `kubectl describe service <이름>` | 서비스 상세 정보 | `kubectl describe svc auth-service` |
| `kubectl get ingress` | 인그레스 목록 | `kubectl get ingress` |
| `kubectl port-forward svc/<이름> <로컬포트>:<서비스포트>` | 로컬 포트 포워딩 | `kubectl port-forward svc/auth-service 3001:3001` |
| `kubectl port-forward pod/<파드명> <로컬>:<원격>` | 파드로 직접 포트 포워딩 | `kubectl port-forward pod/auth-xxx 9090:9090` |

#### 설정 관련

| 명령 | 설명 | 예시 |
|------|------|------|
| `kubectl get configmap` | ConfigMap 목록 | `kubectl get cm` |
| `kubectl get secret` | Secret 목록 | `kubectl get secret` |
| `kubectl describe secret <이름>` | Secret 상세 (값은 base64) | `kubectl describe secret db-credentials` |
| `kubectl get secret <이름> -o jsonpath='{.data.password}' \| base64 -d` | Secret 값 디코딩 | 주의: 운영 환경에서 로그 남김 |

#### 리소스 관리

| 명령 | 설명 | 예시 |
|------|------|------|
| `kubectl apply -f <파일>` | YAML 파일로 리소스 생성/업데이트 | `kubectl apply -f deployment.yaml` |
| `kubectl apply -f <디렉토리>/` | 디렉토리의 모든 YAML 적용 | `kubectl apply -f k8s/` |
| `kubectl delete -f <파일>` | YAML 파일로 리소스 삭제 | `kubectl delete -f deployment.yaml` |
| `kubectl delete pod <이름> --force --grace-period=0` | 파드 강제 삭제 (Terminating 고착 시) | 주의: 데이터 손실 가능 |
| `kubectl get all -n <네임스페이스>` | 네임스페이스의 모든 리소스 | `kubectl get all -n saas-prod` |

#### 네임스페이스 관련

| 명령 | 설명 | 예시 |
|------|------|------|
| `kubectl get namespaces` | 네임스페이스 목록 | `kubectl get ns` |
| `kubectl create namespace <이름>` | 네임스페이스 생성 | `kubectl create ns saas-test` |
| `kubectl config set-context --current --namespace=<이름>` | 기본 네임스페이스 변경 | `kubectl config set-context --current --namespace=saas-prod` |

#### 컨텍스트 관련

| 명령 | 설명 | 예시 |
|------|------|------|
| `kubectl config get-contexts` | 사용 가능한 클러스터 목록 | `kubectl config get-contexts` |
| `kubectl config use-context <이름>` | 클러스터 전환 | `kubectl config use-context prod-cluster` |
| `kubectl config current-context` | 현재 컨텍스트 확인 | `kubectl config current-context` |
| `kubectl cluster-info` | 클러스터 정보 | `kubectl cluster-info` |
| `kubectl get nodes` | 노드 목록 및 상태 | `kubectl get nodes` |
| `kubectl top node` | 노드 CPU/메모리 사용량 | `kubectl top node` |

---

### 2.2 helm 명령어

Helm은 Kubernetes 패키지 관리자입니다. 이 프로젝트에서는 Flux가 Helm을 자동으로 관리하지만, 수동 작업이 필요한 경우에 사용합니다.

| 명령 | 설명 | 예시 |
|------|------|------|
| `helm list` | 현재 설치된 릴리즈 목록 | `helm list -n saas-prod` |
| `helm list -A` | 모든 네임스페이스의 릴리즈 | `helm list -A` |
| `helm status <릴리즈명>` | 릴리즈 상태 확인 | `helm status auth-service -n saas-prod` |
| `helm history <릴리즈명>` | 릴리즈 히스토리 | `helm history auth-service -n saas-prod` |
| `helm install <릴리즈> <차트>` | 새 릴리즈 설치 | `helm install auth-service ./charts/auth-service -n saas-dev` |
| `helm install <릴리즈> <차트> -f values.yaml` | 사용자 정의 values로 설치 | `helm install auth-service ./charts/auth-service -f values-dev.yaml` |
| `helm upgrade <릴리즈> <차트>` | 릴리즈 업그레이드 | `helm upgrade auth-service ./charts/auth-service -n saas-prod` |
| `helm upgrade --install <릴리즈> <차트>` | 없으면 설치, 있으면 업그레이드 | `helm upgrade --install auth-service ./charts/auth-service` |
| `helm rollback <릴리즈> <버전>` | 이전 버전으로 롤백 | `helm rollback auth-service 3 -n saas-prod` |
| `helm uninstall <릴리즈>` | 릴리즈 제거 | `helm uninstall auth-service -n saas-dev` |
| `helm get values <릴리즈>` | 현재 적용된 values 확인 | `helm get values auth-service -n saas-prod` |
| `helm get manifest <릴리즈>` | 렌더링된 Kubernetes YAML 확인 | `helm get manifest auth-service` |
| `helm template <릴리즈> <차트>` | YAML 렌더링만 (설치 없음) | `helm template auth-service ./charts/auth-service` |
| `helm lint <차트>` | 차트 문법 검사 | `helm lint ./charts/auth-service` |
| `helm repo add <이름> <URL>` | 차트 저장소 추가 | `helm repo add bitnami https://charts.bitnami.com/bitnami` |
| `helm repo update` | 차트 저장소 목록 업데이트 | `helm repo update` |
| `helm search repo <키워드>` | 저장소에서 차트 검색 | `helm search repo postgresql` |

```bash
# 실전 예시: 스테이징 환경에 새 서비스 배포
helm upgrade --install auth-service \
  ./platform/infra/helm/auth-service \
  -n saas-stg \
  -f ./platform/infra/helm/auth-service/values-stg.yaml \
  --atomic \       # 실패 시 자동 롤백
  --timeout=120s   # 타임아웃 설정
```

---

### 2.3 flux 명령어

Flux는 GitOps 기반의 지속적 배포 도구입니다. Git 저장소의 변경을 감지하여 자동으로 클러스터에 적용합니다.

| 명령 | 설명 | 예시 |
|------|------|------|
| `flux get all` | 모든 Flux 리소스 상태 | `flux get all -n flux-system` |
| `flux get kustomizations` | Kustomization 목록 | `flux get ks` |
| `flux get helmreleases` | HelmRelease 목록 | `flux get hr -n saas-prod` |
| `flux get helmrepositories` | Helm 저장소 목록 | `flux get helmrepositories` |
| `flux get gitrepositories` | Git 저장소 목록 | `flux get gitrepositories` |
| `flux reconcile source git <이름>` | Git 저장소 즉시 동기화 | `flux reconcile source git public-saas` |
| `flux reconcile kustomization <이름>` | Kustomization 즉시 적용 | `flux reconcile ks saas-apps` |
| `flux reconcile helmrelease <이름>` | HelmRelease 즉시 적용 | `flux reconcile hr auth-service -n saas-prod` |
| `flux suspend kustomization <이름>` | Kustomization 자동 적용 일시 중지 | `flux suspend ks saas-apps` |
| `flux resume kustomization <이름>` | Kustomization 자동 적용 재개 | `flux resume ks saas-apps` |
| `flux suspend helmrelease <이름>` | HelmRelease 자동 적용 일시 중지 | `flux suspend hr auth-service -n saas-prod` |
| `flux resume helmrelease <이름>` | HelmRelease 자동 적용 재개 | `flux resume hr auth-service -n saas-prod` |
| `flux logs` | Flux 컨트롤러 로그 | `flux logs --follow` |
| `flux logs --kind=HelmRelease` | 특정 리소스 종류의 로그 | `flux logs --kind=HelmRelease` |
| `flux check` | Flux 컨트롤러 상태 확인 | `flux check` |
| `flux version` | Flux 버전 확인 | `flux version` |
| `flux install` | Flux 설치 (초기 설정) | `flux install` |
| `flux uninstall` | Flux 제거 | `flux uninstall` |
| `flux bootstrap gitea` | Gitea와 Flux 연결 설정 | `flux bootstrap gitea --owner=org --repository=public-saas` |

```bash
# 실전 예시: 배포 상태 확인 및 강제 동기화
# 1. 현재 상태 확인
flux get helmreleases -n saas-prod

# 2. Git 저장소 최신 커밋 즉시 반영
flux reconcile source git public-saas --with-source

# 3. 특정 서비스만 재배포
flux reconcile helmrelease auth-service -n saas-prod --with-source
```

---

### 2.4 k9s TUI 단축키

k9s는 터미널 기반 Kubernetes 관리 UI입니다. 마우스 없이 키보드만으로 Kubernetes 리소스를 조회하고 관리할 수 있습니다.

#### k9s 실행

```bash
k9s                          # 기본 실행 (기본 네임스페이스)
k9s -n saas-prod             # 특정 네임스페이스로 시작
k9s --context prod-cluster   # 특정 컨텍스트로 시작
k9s --readonly               # 읽기 전용 모드 (실수 방지)
```

#### 전역 단축키

| 단축키 | 설명 |
|--------|------|
| `?` | 도움말 (단축키 목록) |
| `Ctrl+A` | 모든 별칭(alias) 목록 |
| `Ctrl+C` 또는 `q` | k9s 종료 |
| `ESC` | 이전 화면으로 돌아가기 |
| `/` | 검색 필터 입력 |
| `!` | 검색 필터 반전 |
| `Ctrl+R` | 화면 새로고침 |

#### 네비게이션

| 단축키 | 설명 |
|--------|------|
| `:pods` | 파드 목록으로 이동 |
| `:deploy` | Deployment 목록으로 이동 |
| `:svc` | Service 목록으로 이동 |
| `:ns` | 네임스페이스 선택 |
| `:node` | 노드 목록으로 이동 |
| `:cm` | ConfigMap 목록 |
| `:secret` | Secret 목록 |
| `:ing` | Ingress 목록 |
| `:pvc` | PersistentVolumeClaim 목록 |
| `:helmreleases` | Flux HelmRelease 목록 |
| `:hr` | helmreleases 단축 별칭 |
| `숫자 0~9` | 자주 사용하는 리소스 단축키 (설정 가능) |

#### 파드 조작

| 단축키 | 설명 |
|--------|------|
| `Enter` | 선택한 리소스의 상세 컨테이너 목록 |
| `l` | 선택한 파드의 로그 보기 |
| `f` | 로그 스트리밍 (follow) |
| `p` | 이전 컨테이너 로그 (previous) |
| `s` | 파드 내부 셸 접속 (exec) |
| `d` | 리소스 describe (상세 정보) |
| `e` | 리소스 YAML 편집 (kubectl edit) |
| `y` | 리소스 YAML 출력 |
| `Ctrl+D` | 리소스 삭제 (파드는 재시작됨) |
| `Ctrl+K` | 파드 강제 종료 (kill) |
| `Ctrl+L` | 파드 로그 필터 설정 |
| `x` | 파드 실행 종료 후 삭제 |

#### 뷰 조작

| 단축키 | 설명 |
|--------|------|
| `a` | 모든 네임스페이스 토글 |
| `w` | 리소스 감시 모드 (watch) 토글 |
| `z` | 페이지 크기 조정 |
| `Ctrl+U` | 목록 상단으로 이동 |
| `g/G` | 목록 맨 위 / 맨 아래로 이동 |

---

### 2.5 stern 명령어

stern은 여러 파드의 로그를 동시에 스트리밍하는 도구입니다. 각 파드의 로그가 색상으로 구분되어 표시됩니다.

```bash
# stern 설치
curl -L "https://github.com/stern/stern/releases/latest/download/stern_linux_amd64.tar.gz" | tar xz
sudo mv stern /usr/local/bin/
```

| 명령 | 설명 | 예시 |
|------|------|------|
| `stern <파드패턴>` | 패턴 매칭 파드 로그 스트리밍 | `stern auth-service` |
| `stern <패턴> -n <네임스페이스>` | 특정 네임스페이스에서 | `stern "auth" -n saas-prod` |
| `stern <패턴> --all-namespaces` | 모든 네임스페이스에서 | `stern auth --all-namespaces` |
| `stern <패턴> -c <컨테이너>` | 특정 컨테이너만 | `stern auth -c app` |
| `stern <패턴> --since 5m` | 최근 5분치 로그 | `stern auth --since 5m` |
| `stern <패턴> --since 1h` | 최근 1시간치 로그 | `stern "saas-" --since 1h` |
| `stern <패턴> --tail 100` | 최근 100줄만 | `stern auth --tail 100` |
| `stern <패턴> -l <레이블>` | 레이블 셀렉터로 필터 | `stern "" -l app=auth-service` |
| `stern <패턴> --include <정규식>` | 특정 패턴 포함 로그만 | `stern auth --include "ERROR\|WARN"` |
| `stern <패턴> --exclude <정규식>` | 특정 패턴 제외 | `stern auth --exclude "healthcheck"` |
| `stern <패턴> -o json` | JSON 형식으로 출력 | `stern auth -o json` |
| `stern <패턴> -o raw` | 원시 로그만 (파드명 없음) | `stern auth -o raw` |

```bash
# 실전 예시: 전체 서비스 오류 로그 모니터링
stern "saas-" -n saas-prod --include "ERROR|FATAL|CRITICAL" --since 30m

# 특정 테넌트의 요청 추적
stern auth-service -n saas-prod --include "tenantId.*abc123" --since 1h
```

---

### 2.6 linkerd 명령어

Linkerd는 이 프로젝트의 서비스 메시입니다. mTLS, 트래픽 관찰, 서킷 브레이커 기능을 제공합니다.

| 명령 | 설명 | 예시 |
|------|------|------|
| `linkerd check` | Linkerd 설치 상태 전체 점검 | `linkerd check` |
| `linkerd version` | Linkerd CLI 및 서버 버전 | `linkerd version` |
| `linkerd install` | Linkerd 컨트롤 플레인 설치 YAML 생성 | `linkerd install \| kubectl apply -f -` |
| `linkerd inject <파일>` | Deployment YAML에 프록시 주입 | `linkerd inject deployment.yaml \| kubectl apply -f -` |
| `linkerd uninject <파일>` | 프록시 주입 제거 | `linkerd uninject deployment.yaml` |
| `linkerd viz install` | Linkerd Viz 관측성 컴포넌트 설치 | `linkerd viz install \| kubectl apply -f -` |
| `linkerd viz check` | Viz 컴포넌트 상태 점검 | `linkerd viz check` |
| `linkerd viz dashboard` | 웹 대시보드 열기 (브라우저) | `linkerd viz dashboard &` |
| `linkerd viz stat deploy` | Deployment 트래픽 통계 | `linkerd viz stat deploy -n saas-prod` |
| `linkerd viz stat svc` | Service 트래픽 통계 | `linkerd viz stat svc -n saas-prod` |
| `linkerd viz stat deploy/<이름>` | 특정 Deployment 통계 | `linkerd viz stat deploy/auth-service -n saas-prod` |
| `linkerd viz top deploy/<이름>` | 실시간 요청 모니터링 | `linkerd viz top deploy/auth-service` |
| `linkerd viz tap deploy/<이름>` | 실시간 요청 내용 캡처 | `linkerd viz tap deploy/auth-service` |
| `linkerd viz tap deploy/<이름> --to deploy/<대상>` | 특정 목적지로의 요청만 | `linkerd viz tap deploy/api-gateway --to deploy/auth-service` |
| `linkerd viz routes deploy/<이름>` | 라우트별 성공률 통계 | `linkerd viz routes deploy/auth-service` |
| `linkerd viz edges deploy` | 서비스 간 연결 엣지 목록 | `linkerd viz edges deploy -n saas-prod` |

```bash
# 실전 예시: 인증 서비스 성공률 확인
linkerd viz stat deploy/auth-service -n saas-prod

# 출력 예시:
# NAME           MESHED   SUCCESS      RPS   LATENCY_P50   LATENCY_P95   LATENCY_P99   TCP_CONN
# auth-service   2/2       99.8%   150.5rps          12ms          45ms          89ms         4

# 실시간 요청 모니터링 (트러블슈팅 시)
linkerd viz tap deploy/api-gateway --to deploy/auth-service --method POST
```

---

## 3. 보안 도구

### 3.1 semgrep 로컬 실행

semgrep은 CSAP D-12 코드 보안 검사를 위해 사용하는 정적 분석 도구입니다.

```bash
# semgrep 설치
pip install semgrep

# 또는 Docker로 실행
docker run --rm -v "${PWD}:/src" semgrep/semgrep semgrep --config auto /src
```

| 명령 | 설명 | 예시 |
|------|------|------|
| `semgrep --config auto <경로>` | 자동 규칙 선택으로 스캔 | `semgrep --config auto src/` |
| `semgrep --config p/typescript <경로>` | TypeScript 규칙셋 적용 | `semgrep --config p/typescript src/` |
| `semgrep --config p/owasp-top-ten <경로>` | OWASP Top 10 규칙 | `semgrep --config p/owasp-top-ten src/` |
| `semgrep --config p/jwt <경로>` | JWT 관련 보안 검사 | `semgrep --config p/jwt src/` |
| `semgrep --config p/sql-injection <경로>` | SQL 주입 취약점 검사 | `semgrep --config p/sql-injection src/` |
| `semgrep --config p/secrets <경로>` | 하드코딩된 시크릿 탐지 | `semgrep --config p/secrets .` |
| `semgrep --json <경로>` | JSON 형식으로 결과 출력 | `semgrep --config auto --json src/ > report.json` |
| `semgrep --sarif <경로>` | SARIF 형식 출력 (Gitea 통합) | `semgrep --config auto --sarif src/` |
| `semgrep --severity ERROR <경로>` | ERROR 수준 이상만 표시 | `semgrep --config auto --severity ERROR src/` |
| `semgrep --exclude <패턴>` | 특정 파일 제외 | `semgrep --config auto --exclude "*.test.ts" src/` |

```bash
# 프로젝트 전체 보안 스캔 (Q-Gate G5와 동일)
semgrep --config p/owasp-top-ten \
        --config p/secrets \
        --config p/typescript \
        --severity ERROR \
        platform/services/

# 결과 중 SQL 주입 취약점만 필터
semgrep --config p/sql-injection --json src/ | jq '.results[] | .path, .extra.message'
```

---

### 3.2 trivy 이미지/파일 스캔

trivy는 컨테이너 이미지와 파일시스템의 취약점을 스캔합니다. Harbor 레지스트리에 이미지 푸시 시 자동으로 실행되지만, 로컬에서도 사용할 수 있습니다.

```bash
# trivy 설치
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
```

| 명령 | 설명 | 예시 |
|------|------|------|
| `trivy image <이미지>` | 컨테이너 이미지 스캔 | `trivy image harbor.local/auth-service:latest` |
| `trivy image --severity HIGH,CRITICAL <이미지>` | 고위험/심각 취약점만 표시 | `trivy image --severity HIGH,CRITICAL nginx:latest` |
| `trivy image --format json <이미지>` | JSON 형식으로 출력 | `trivy image --format json auth-service:v1.0 > scan.json` |
| `trivy image --format sarif <이미지>` | SARIF 형식 (CI/CD 통합) | `trivy image --format sarif auth-service:v1.0` |
| `trivy image --ignore-unfixed <이미지>` | 수정 불가 취약점 제외 | `trivy image --ignore-unfixed auth-service:latest` |
| `trivy fs <경로>` | 파일시스템 스캔 | `trivy fs /data/ai-saas` |
| `trivy fs --security-checks secret <경로>` | 시크릿 파일 탐지 | `trivy fs --security-checks secret .` |
| `trivy repo <URL>` | Git 저장소 스캔 | `trivy repo https://gitea.local/org/repo` |
| `trivy k8s --report summary all` | k8s 클러스터 전체 스캔 | `trivy k8s --report summary all` |
| `trivy k8s -n saas-prod all` | 특정 네임스페이스 스캔 | `trivy k8s -n saas-prod all` |
| `trivy config <경로>` | IaC(Kubernetes YAML) 설정 검사 | `trivy config platform/infra/k8s/` |

```bash
# 실전 예시: 빌드 후 이미지 스캔 (CI/CD에서 사용)
docker build -t auth-service:$(git rev-parse --short HEAD) .
trivy image --severity HIGH,CRITICAL --exit-code 1 auth-service:$(git rev-parse --short HEAD)
# exit-code 1: 취약점 발견 시 파이프라인 실패
```

---

### 3.3 cosign 서명/검증

cosign은 컨테이너 이미지의 무결성을 서명과 검증으로 보장합니다. CSAP D-12(공급망 보안) 요건 충족에 사용됩니다.

```bash
# cosign 설치
curl -Lo cosign https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64
chmod +x cosign
sudo mv cosign /usr/local/bin/
```

| 명령 | 설명 | 예시 |
|------|------|------|
| `cosign generate-key-pair` | 서명 키 페어 생성 | `cosign generate-key-pair` |
| `cosign sign <이미지>` | 이미지 서명 | `cosign sign --key cosign.key harbor.local/auth:v1.0` |
| `cosign sign --key <키파일> <이미지>` | 특정 키로 서명 | `cosign sign --key cosign.key harbor.local/auth:v1.0` |
| `cosign verify <이미지>` | 이미지 서명 검증 | `cosign verify --key cosign.pub harbor.local/auth:v1.0` |
| `cosign verify --key <공개키> <이미지>` | 특정 공개키로 검증 | `cosign verify --key cosign.pub harbor.local/auth:v1.0` |
| `cosign attest --key <키> --type <타입> <이미지>` | 어테스테이션 추가 | `cosign attest --key cosign.key --type sbom harbor.local/auth:v1.0` |
| `cosign verify-attestation --key <키> --type <타입> <이미지>` | 어테스테이션 검증 | `cosign verify-attestation --key cosign.pub --type sbom harbor.local/auth:v1.0` |
| `cosign download signature <이미지>` | 서명 데이터 다운로드 | `cosign download signature harbor.local/auth:v1.0` |
| `cosign triangulate <이미지>` | 서명 저장 위치 확인 | `cosign triangulate harbor.local/auth:v1.0` |

```bash
# 실전 예시: CI/CD 파이프라인에서 이미지 서명
# 1. 빌드
docker build -t harbor.local/auth-service:v1.2.0 .

# 2. 서명 (CI 서버에서 --key 대신 KMS 또는 환경 변수 사용)
cosign sign --key env://COSIGN_PRIVATE_KEY harbor.local/auth-service:v1.2.0

# 3. 배포 전 검증
cosign verify --key cosign.pub harbor.local/auth-service:v1.2.0
```

---

### 3.4 vault CLI

HashiCorp Vault는 시크릿 중앙 관리 시스템입니다. API 키, DB 비밀번호, 인증서 등을 안전하게 보관합니다.

```bash
# VAULT_ADDR 환경 변수 설정
export VAULT_ADDR='https://vault.내부.go.kr:8200'

# 인증 (토큰 방식)
export VAULT_TOKEN='hvs.xxx...'
```

| 명령 | 설명 | 예시 |
|------|------|------|
| `vault status` | Vault 서버 상태 확인 | `vault status` |
| `vault login -method=token` | 토큰으로 로그인 | `vault login -method=token` |
| `vault login -method=oidc` | OIDC로 로그인 | `vault login -method=oidc` |
| `vault kv get <경로>` | 시크릿 조회 | `vault kv get secret/saas/prod/db` |
| `vault kv get -field=<필드> <경로>` | 특정 필드만 조회 | `vault kv get -field=password secret/saas/prod/db` |
| `vault kv list <경로>` | 경로의 키 목록 | `vault kv list secret/saas/prod` |
| `vault kv put <경로> <키>=<값>` | 시크릿 저장/업데이트 | `vault kv put secret/saas/dev/db password=dev123` |
| `vault kv delete <경로>` | 시크릿 삭제 | `vault kv delete secret/saas/dev/old-key` |
| `vault kv metadata get <경로>` | 시크릿 메타데이터 (버전 히스토리) | `vault kv metadata get secret/saas/prod/db` |
| `vault lease renew <lease-id>` | 임시 시크릿 갱신 | `vault lease renew database/creds/readonly/xxx` |
| `vault lease revoke <lease-id>` | 임시 시크릿 즉시 폐기 | `vault lease revoke database/creds/readonly/xxx` |
| `vault token lookup` | 현재 토큰 정보 확인 | `vault token lookup` |
| `vault token renew` | 토큰 갱신 | `vault token renew` |
| `vault audit list` | 감사 장치 목록 | `vault audit list` |
| `vault policy list` | 정책 목록 | `vault policy list` |
| `vault policy read <이름>` | 정책 내용 확인 | `vault policy read saas-readonly` |

```bash
# 실전 예시: DB 자격 증명 동적 발급 (Vault Database 시크릿 엔진)
# 임시 DB 자격 증명 발급 (TTL: 1시간)
vault read database/creds/saas-readonly
# 출력:
# Key             Value
# lease_duration  1h
# username        v-readonly-xxx
# password        A1B2C3D4-xxx

# 발급된 자격 증명 즉시 폐기
vault lease revoke <lease_id>
```

---

## 4. Claude Code

### 4.1 claude 명령어

Claude Code는 이 프로젝트의 AI 보조 개발 도구입니다. CLAUDE.md의 모든 규칙을 자동으로 인식하고 준수합니다.

```bash
# 기본 실행 (프로젝트 루트에서)
cd /data/ai-saas
claude
```

| 명령/플래그 | 설명 | 예시 |
|------------|------|------|
| `claude` | 대화형 모드 시작 | `claude` |
| `claude "<프롬프트>"` | 단일 프롬프트 실행 | `claude "auth-service의 JWT 검증 로직을 설명해줘"` |
| `claude -p "<프롬프트>"` | 단일 프롬프트 후 종료 (--print) | `claude -p "이 파일의 버그를 찾아줘"` |
| `claude --version` | Claude Code 버전 확인 | `claude --version` |
| `claude --help` | 도움말 출력 | `claude --help` |
| `claude --model <모델>` | 사용할 모델 지정 | `claude --model claude-opus-4-6` |
| `claude --resume <세션ID>` | 이전 세션 재개 | `claude --resume abc123` |
| `claude --continue` | 가장 최근 세션 계속 | `claude --continue` |
| `claude --no-markdown` | 마크다운 렌더링 없이 텍스트로 출력 | `claude --no-markdown` |
| `claude -d` | 디버그 모드 | `claude -d` |

#### 주요 환경 변수

| 환경 변수 | 설명 | 기본값 |
|---------|------|------|
| `ANTHROPIC_API_KEY` | Anthropic API 키 (필수) | 없음 |
| `CLAUDE_MODEL` | 기본 모델 설정 | `claude-sonnet-4-6` |
| `ECC_GOVERNANCE_CAPTURE` | 민감 작업 로깅 활성화 | `1` (이 프로젝트) |

---

### 4.2 슬래시 커맨드

Claude Code 대화 중에 슬래시(`/`)로 시작하는 특수 명령어를 사용할 수 있습니다.

#### 내장 슬래시 커맨드

| 명령 | 설명 |
|------|------|
| `/help` | 사용 가능한 슬래시 커맨드 목록 |
| `/clear` | 현재 대화 기록 초기화 |
| `/compact` | 현재 대화를 요약하여 컨텍스트 절약 (긴 작업 시 사용) |
| `/exit` 또는 `/quit` | Claude Code 종료 |
| `/model` | 현재 사용 중인 모델 확인 |
| `/status` | 현재 세션 상태 확인 |
| `/cost` | 현재 세션의 API 비용 확인 |
| `/save` | 대화 내용을 파일로 저장 |

#### 프로젝트 커스텀 슬래시 커맨드 (`.claude/commands/`)

이 프로젝트에서 정의된 슬래시 커맨드입니다.

| 명령 | 설명 | 사용 시점 |
|------|------|---------|
| `/pm` | PM(Product Manager) 에이전트 실행 — 세션 보고서 작성 | 작업 세션 종료 시 |
| `/bkit` | bkit 에이전트 실행 — PDCA 사이클 관리 | 신규 MTU 시작 시 |

#### 에이전트 호출 방식

Claude Code 대화 중 에이전트를 직접 호출할 수 있습니다.

```
# Implementer 에이전트 (기능 구현)
MTU-N253 CSAP 증적 수집 엔진을 구현해줘.
Plan 문서는 docs/01-plan/mtus/MTU-N253.plan.md를 참조해.

# Reviewer 에이전트 (코드 리뷰)
platform/services/auth-service/src/handlers/auth.handler.ts를 리뷰해줘.
CSAP D-08, D-09, D-12 기준으로 검토해.

# Auditor 에이전트 (CSAP 감리)
MTU-N253 구현 완료. CSAP D-06, D-08 준수 여부를 감리해줘.

# Tester 에이전트 (테스트 작성)
auth.handler.ts에 대한 단위 테스트를 작성해줘.
커버리지 80% 이상을 목표로 해.

# Refactorer 에이전트 (리팩토링)
auth-service의 dead code를 제거하고 단일 책임 원칙을 적용해줘.
```

#### /compact 사용 시점

긴 작업 도중 컨텍스트가 50%를 넘으면 `/compact`를 실행하는 것이 권장됩니다.

```
작업 중 Claude Code가 다음과 같은 경고를 표시하면:
"컨텍스트가 50%에 도달했습니다."

→ /compact 실행
  현재까지의 작업 내용이 요약되어 컨텍스트를 절약합니다.
  작업 연속성은 유지됩니다.
```

---

## 5. 빠른 참조 카드

가장 자주 사용하는 명령어만 모아놓은 빠른 참조표입니다.

### 5.1 일상 개발 명령어

```bash
# ── 프로젝트 시작 ──
cd /data/ai-saas
pnpm install                          # 의존성 설치
pnpm build                            # 전체 빌드
pnpm --filter @public-saas/<서비스> dev  # 특정 서비스 개발 모드

# ── 테스트 ──
pnpm test                             # 전체 테스트
pnpm --filter @public-saas/<서비스> test:coverage  # 커버리지 포함

# ── 코드 품질 ──
pnpm lint                             # 린트
pnpm typecheck                        # 타입 검사

# ── 커밋 ──
git add <파일>
git commit -m "feat(<서비스>): <설명> (#이슈번호)"
git push origin <브랜치명>
```

### 5.2 운영 확인 명령어

```bash
# ── 파드 상태 ──
kubectl get pods -n saas-prod -w           # 실시간 감시
kubectl logs -f <파드명> -n saas-prod      # 로그 스트리밍
stern "saas-" -n saas-prod --since 30m     # 전체 서비스 로그

# ── 배포 상태 ──
flux get helmreleases -n saas-prod         # GitOps 배포 상태
helm list -n saas-prod                     # Helm 릴리즈 목록
kubectl rollout status deploy/<서비스> -n saas-prod  # 배포 진행 상태

# ── 트러블슈팅 ──
kubectl describe pod <파드명> -n saas-prod  # 파드 이벤트 확인
kubectl exec -it <파드명> -n saas-prod -- bash  # 파드 내부 접속
linkerd viz stat deploy -n saas-prod        # 서비스 메시 상태
```

### 5.3 보안 스캔 명령어

```bash
# ── 로컬 보안 검사 ──
semgrep --config p/owasp-top-ten --config p/secrets src/  # 보안 취약점 스캔
trivy image <이미지>:<태그>                                  # 이미지 취약점 스캔
trivy fs --security-checks secret .                         # 시크릿 파일 탐지

# ── Vault 시크릿 조회 ──
vault kv get secret/saas/prod/db            # DB 자격 증명 조회
vault kv get -field=password secret/saas/prod/db  # 특정 필드만
```

---

## 6. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|------|
| 1.0.0 | 2026-04-12 | 최초 작성 — pnpm, turbo, prisma, kubectl 50개, helm, flux, k9s, stern, linkerd, semgrep, trivy, cosign, vault, claude 명령어 레퍼런스 | Implementer (Sonnet) |

---

*이 도구 레퍼런스에 누락된 명령어가 있거나 오류를 발견하면 Gitea에 PR을 제출하십시오.*
*각 도구의 공식 문서 링크는 `11-faq/01-dev-faq.md`에 정리되어 있습니다.*
