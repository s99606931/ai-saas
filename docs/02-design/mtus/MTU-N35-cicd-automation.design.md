# MTU-N35 Design: CI/CD 완전 자동화 시스템

> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **작성자**: PM Lead (CTO 위임)
> **Plan 참조**: docs/01-plan/mtus/MTU-N35-cicd-automation.plan.md

---

## 1. 아키텍처 개요

### 1.1 전체 CI/CD 파이프라인 흐름

```
Developer → git push → Gitea → Gitea Actions Runner
  ↓
[CI 단계]
  ├─ pnpm install + typecheck + lint
  ├─ pnpm build
  ├─ pnpm test (단위 + 통합)
  └─ Helm lint + template
  ↓
[CD 단계]
  ├─ Docker build (멀티 서비스)
  ├─ Harbor push (이미지 레지스트리)
  ├─ Cosign sign (이미지 서명)
  └─ Flux GitOps 동기화 → k3s 배포
  ↓
[검증 단계]
  ├─ Health check
  ├─ Smoke test
  └─ 감사 로그 기록 (CSAP D-06)
```

### 1.2 Flux GitOps 배포 아키텍처

```
Gitea Repository (fleet-infra)
  ├─ infra/flux/gitea-source.yaml      ← GitRepository
  ├─ infra/flux/helm-release.yaml      ← HelmRelease (saas-platform)
  ├─ infra/flux/platform-kustomization.yaml  ← Kustomization
  └─ infra/flux/notification.yaml      ← Alert (Gitea 알림)

Flux Controller (flux-system 네임스페이스)
  ├─ source-controller → Gitea 레포 5분 주기 폴링
  ├─ kustomize-controller → 매니페스트 적용
  └─ helm-controller → HelmRelease 관리
```

---

## 2. 설계 결정

### 2.1 통합 워크플로우 vs 분리 워크플로우

**선택: 통합 워크플로우** (ci-cd-pipeline.yml)
- 기존 ci.yml + deploy.yml + sign-image.yml을 하나의 통합 파이프라인으로 재구성
- 기존 개별 워크플로우는 유지 (호환성)
- 통합 파이프라인은 main/stg 브랜치 push 시 전체 실행

### 2.2 배포 전략

**선택: Helm + Flux GitOps**
- HelmRelease CRD로 Helm 배포 관리
- Flux가 Git 레포 변경 자동 감지 → 배포
- 환경별 values 파일 분리 (dev/stg/prod)

---

## 3. 상세 설계

### 3.1 통합 CI/CD 파이프라인 (FR-N35.1)

```yaml
# 워크플로우 구조
jobs:
  ci:        # 빌드 + 테스트 + 린트
  security:  # 보안 스캔 (OWASP, 의존성 감사)
  build:     # Docker 이미지 빌드 + Harbor 푸시
  sign:      # Cosign 이미지 서명
  deploy:    # Helm 배포 (Flux 또는 직접)
  verify:    # 헬스체크 + 스모크테스트
  notify:    # 감사 로그 + 알림
```

### 3.2 Flux HelmRelease (FR-N35.2)

```yaml
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: saas-platform
spec:
  chart:
    spec:
      chart: ./helm/saas-platform
      sourceRef:
        kind: GitRepository
        name: fleet-infra
  values:
    global:
      imageRegistry: localhost:8080
```

### 3.3 원클릭 배포 스크립트 (FR-N35.3)

```bash
# 실행 흐름
1. 사전 조건 확인 (k3s, helm, flux, harbor)
2. 네임스페이스 생성 + Secrets 설정
3. Flux 부트스트랩 (최초 실행 시)
4. GitRepository + HelmRelease 적용
5. 배포 상태 확인 + 헬스체크
6. 접속 정보 출력
```

### 3.4 사용자 가이드 구조 (FR-N35.4)

```markdown
1. 개요 및 전체 아키텍처
2. 사전 준비사항
3. Gitea Actions Runner 설정
4. CI/CD 파이프라인 이해
5. Harbor 이미지 레지스트리 설정
6. Flux GitOps 설정
7. 환경별 배포 (dev/stg/prod)
8. 배포 확인 및 롤백
9. 문제 해결 가이드
10. 감사 로그 확인
```

---

## 4. CSAP 준수 사항

| CSAP 항목 | 적용 내용 |
|-----------|----------|
| D-06 | 모든 배포 이벤트 감사 로그 기록 |
| D-08 | Harbor 인증, Gitea 시크릿 기반 접근 통제 |
| D-11 | 컨테이너 이미지 서명 검증 (Cosign) |
| D-12 | 자동화된 보안 스캔, 의존성 감사 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
