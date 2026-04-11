# 6장: CI/CD 파이프라인 완전 가이드

> 공공기관 SaaS 프레임워크 신규 직원 온보딩 가이드북
> 버전: 1.0.0 | 작성일: 2026-04-11 | 대상: 전체 개발 직원

---

## 목차

1. [CI/CD 파이프라인 개요](#1-cicd-파이프라인-개요)
2. [브랜치 전략](#2-브랜치-전략)
3. [CI 파이프라인 단계](#3-ci-파이프라인-단계)
4. [Q-Gate 품질 게이트 이해](#4-q-gate-품질-게이트-이해)
5. [DevSecOps 파이프라인](#5-devsecops-파이프라인)
6. [배포 파이프라인](#6-배포-파이프라인)
7. [DORA 게이트](#7-dora-게이트)
8. [핫픽스 프로세스](#8-핫픽스-프로세스)
9. [실습: 내 변경사항을 프로덕션까지](#9-실습-내-변경사항을-프로덕션까지)

---

## 1. CI/CD 파이프라인 개요

### 1.1 전체 파이프라인 흐름도

공공기관 SaaS 프레임워크는 코드 작성부터 프로덕션 배포까지 완전 자동화된 파이프라인을 운영합니다. 아래 흐름도는 한 줄의 코드가 어떤 검증 과정을 거쳐 사용자에게 도달하는지 보여줍니다.

```
[개발자 로컬]
    │
    │  git push feat/my-feature
    ▼
[Gitea 저장소]
    │
    ├──▶ [detect-changes]  변경 영역 분류
    │        │ services_changed / packages_changed / docs_only
    │        ▼
    ├──▶ [install]         pnpm 의존성 설치 + 캐시
    │        │
    │        ├──▶ [lint]       ESLint 코드 스타일 검사 (병렬)
    │        ├──▶ [typecheck]  TypeScript 타입 검사 (병렬)
    │        ├──▶ [build]      pnpm build (병렬)
    │        └──▶ [helm-lint]  Helm Chart 유효성 (병렬)
    │                 │
    │                 ▼
    │            [test]       단위 + 통합 테스트
    │                 │
    │                 ▼  (PR인 경우에만)
    │            [e2e]        E2E 통합 테스트
    │
    ├──▶ [Q-Gate]  G1~G7 품질 게이트 (PR → main/stg)
    │
    ├──▶ [DevSecOps]  Trivy / Semgrep / Secret Scan / Kyverno (병렬)
    │
    ├──▶ [Matrix Build]  서비스별 Docker 이미지 병렬 빌드
    │         │
    │         ▼
    │    [SBOM 생성]  Syft CycloneDX + Grype 취약점 스캔
    │         │
    │         ▼
    │    [Cosign 서명]  이미지 서명 + SLSA Provenance Level 3
    │
    ▼
[stg 브랜치 머지]
    │
    ├──▶ [스테이징 배포]  Helm upgrade → k3s staging
    │         │
    │         ▼
    │    [DORA 게이트]  변경 실패율 (CFR) 검증
    │
    ▼
[main 브랜치 태그 v*]
    │
    ├──▶ [Release Pipeline v2]  릴리스 파이프라인
    │         │
    │         ├── SonarQube 품질 게이트
    │         ├── Trivy + Semgrep 보안 스캔
    │         ├── Cosign 서명
    │         ├── 스테이징 배포 (스모크 테스트)
    │         └── SLO 검증 후 프로덕션 Argo Rollouts 배포
    │
    ▼
[프로덕션 서비스]
```

### 1.1.1 전체 CI/CD 파이프라인 플로우 (Mermaid)

```mermaid
flowchart TD
  PUSH[git push] --> PR[Pull Request 생성]
  PR --> CI{CI 파이프라인}
  CI --> LINT[lint + typecheck]
  LINT --> TEST[test - vitest]
  TEST --> BUILD[docker build - BuildKit]
  BUILD --> SIGN[cosign 이미지 서명]
  SIGN --> SBOM[SBOM 생성]
  SBOM --> SCAN[Trivy 취약점 스캔]
  SCAN --> QGATE{Q-Gate G1~G7}
  QGATE -->|통과| MERGE[PR Merge]
  QGATE -->|실패| FIX[수정 후 재시도]
  MERGE --> GITOPS[GitOps: Flux 감지]
  GITOPS --> DEPLOY[k3s 배포]
  DEPLOY --> DORA[DORA 메트릭 기록]
```

**구성요소 설명**:

| 단계 | 역할 | 실패 시 |
|------|------|---------|
| lint + typecheck | ESLint 코드 품질 + TypeScript 타입 오류 탐지 | typecheck 실패 시 파이프라인 즉시 중단 |
| test (vitest) | 단위/통합 테스트 실행. PostgreSQL·Redis 컨테이너 자동 구동 | 커버리지 80% 미만 시 G4 경고 |
| docker build (BuildKit) | 서비스별 이미지 병렬 빌드. GHA 캐시로 레이어 재사용 | 이미지 생성 실패 시 파이프라인 중단 |
| cosign 이미지 서명 | Sigstore Cosign으로 이미지 서명 → Harbor에 서명 첨부 | 서명 실패 시 Kyverno가 배포 차단 |
| SBOM 생성 | Syft로 CycloneDX 1.6 SBOM 생성 → Grype 취약점 스캔 | CRITICAL 취약점 발견 시 배포 차단 |
| Q-Gate G1~G7 | 7단계 품질 게이트. G3(코드 품질)·G5(OWASP)·G7(감사 로그)는 필수 통과 | 필수 게이트 실패 시 PR 머지 차단 |
| GitOps: Flux 감지 | Flux ImagePolicy가 Harbor 신규 이미지를 자동 감지하여 배포 트리거 | Flux 재조정(reconciliation)으로 자동 복구 |
| DORA 메트릭 기록 | 배포 성공 여부를 Prometheus에 기록하여 CFR·LT 산출 | DORA 게이트에서 CFR > 30% 시 다음 배포 차단 |

### 1.2 Gitea Actions 역할 구분

본 프로젝트는 온프레미스 Gitea 저장소와 Gitea Actions 자체 호스팅 러너를 사용합니다. 외부 GitHub Actions 서버를 사용하지 않습니다 (공공기관 망분리 요건).

| 워크플로우 파일 | 위치 | 트리거 | 역할 |
|---------------|------|--------|------|
| `ci.yml` | `.gitea/workflows/` | push/PR | 코어 CI (lint/test/build) |
| `quality-gate.yml` | `.gitea/workflows/` | PR → main/stg | 7단계 품질 게이트 |
| `devsecops.yml` | `.gitea/workflows/` | push + 매일 02:00 | 보안 스캔 통합 |
| `matrix-build.yml` | `.gitea/workflows/` | push (서비스 변경) | 병렬 서비스 빌드 |
| `sbom-scan.yml` | `.gitea/workflows/` | CI 완료 후 | SBOM 생성 + 취약점 스캔 |
| `sign-image.yml` | `.gitea/workflows/` | CI 완료 후 | Cosign 이미지 서명 |
| `slsa-provenance.yml` | `.gitea/workflows/` | 빌드 완료 후 호출 | SLSA Level 3 증명 |
| `deploy.yml` | `.gitea/workflows/` | push main/stg + 태그 | Helm 배포 |
| `release-pipeline-v2.yaml` | `.gitea/workflows/` | 태그 v* | E2E 릴리스 |
| `dora-gate.yml` | `.gitea/workflows/` | workflow_call | DORA 배포 게이트 |
| `hotfix-pipeline.yaml` | `.gitea/workflows/` | push hotfix/** | 긴급 배포 |
| `csap-evidence.yml` | `.gitea/workflows/` | 매주 월요일 09:00 KST | CSAP 증거 자동 수집 |
| `audit-gate.yaml` | `.gitea/workflows/` | 매일 06:00 KST + PR | 감리 Q-Gate 검증 |
| `security.yml` | `.gitea/workflows/` | push + 매주 | 보안 전용 스캔 |
| `scorecard.yaml` | `.gitea/workflows/` | 주기 실행 | OpenSSF Scorecard |

**러너 타입**: `self-hosted` (온프레미스 k3s 클러스터 내 Actions Runner)

---

## 2. 브랜치 전략

### 2.1 브랜치 구조

```
main          ← 프로덕션 (태그 v* 로 릴리스)
  │
  ├── stg     ← 스테이징 (프로덕션 배포 전 검증)
  │     │
  │     ├── feat/my-feature      ← 기능 개발
  │     ├── fix/bug-description  ← 버그 수정
  │     ├── docs/guide-update    ← 문서 업데이트
  │     └── refactor/cleanup     ← 리팩토링
  │
  └── hotfix/critical-fix  ← 긴급 수정 (hotfix 파이프라인)
```

### 2.2 브랜치 네이밍 규칙

모든 브랜치는 `CLAUDE.md §4`에 명시된 Conventional Commits 접두사를 사용합니다.

| 접두사 | 용도 | 예시 |
|--------|------|------|
| `feat/` | 신규 기능 개발 | `feat/tenant-rbac-v2` |
| `fix/` | 버그 수정 | `fix/auth-token-expiry` |
| `docs/` | 문서 작업 | `docs/onboarding-guide` |
| `refactor/` | 리팩토링 | `refactor/audit-log-cleanup` |
| `hotfix/` | 긴급 수정 | `hotfix/critical-security-patch` |

> 주의: `hotfix/**` 브랜치는 별도 hotfix-pipeline.yaml 이 동작합니다. 일반 버그 수정은 반드시 `fix/` 접두사를 사용하십시오.

### 2.3 PR 프로세스 및 리뷰 정책

**PR 대상 브랜치**: `stg` 또는 `main`

**PR 제출 전 필수 확인사항**:
1. `feat/*`, `fix/*` 브랜치에서 `stg`로 PR 생성
2. PR 생성 시 Q-Gate (quality-gate.yml) 자동 실행
3. G3 (코드 품질), G5 (OWASP) 실패 시 머지 불가
4. 최소 1명 이상의 코드 리뷰어 승인 필요
5. 모든 CI 체크 통과 확인

**stg → main PR**:
- 스테이징 배포 결과 확인 후 진행
- DORA 게이트 통과 여부 확인
- 보안팀 추가 승인 필요 (CSAP D-08)

**커밋 메시지 형식** (Conventional Commits):
```
feat(auth): FR-2.1 JWT 토큰 갱신 로직 추가

- 접근 토큰 만료 15분 → 갱신 토큰 7일
- 토큰 블랙리스트 Redis 저장 추가
- CSAP D-08 세션 관리 요건 충족

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## 3. CI 파이프라인 단계

### 3.1 파이프라인 구성 파일: `ci.yml`

**환경 설정**:
```yaml
env:
  PNPM_VERSION: "9.15.0"
  NODE_VERSION: "22"
```

Node.js 22와 pnpm 9.15.0이 표준입니다. 개인 로컬 환경도 이 버전을 맞추십시오.

### 3.2 Step 1: 변경 감지 (detect-changes)

**목적**: 모노레포에서 실제로 변경된 영역만 빌드하여 파이프라인 시간 단축

```
변경 영역 분류:
  platform/services/*  → services_changed = true
  platform/packages/*  → packages_changed = true
  infra/*              → infra_changed = true
  docs/*.md 만 변경   → docs_only = true (빌드 전체 건너뜀)
```

**실무 적용**: PR을 올릴 때 문서만 수정했다면 빌드가 자동으로 건너뛰어집니다. 코드와 문서를 함께 수정했다면 전체 빌드가 실행됩니다.

### 3.3 Step 2: 의존성 설치 (install)

pnpm store 캐시를 `pnpm-lock.yaml` 해시 기반으로 저장합니다. 잠금 파일이 변경되지 않으면 캐시에서 즉시 복원하여 설치 시간을 단축합니다.

```bash
# 로컬에서도 동일하게 실행
pnpm install --frozen-lockfile
```

> 중요: `--frozen-lockfile` 플래그가 필수입니다. 이 플래그 없이는 `pnpm-lock.yaml`이 자동 수정될 수 있습니다.

### 3.4 Step 3: 병렬 검사 (lint / typecheck / build / helm-lint)

네 가지 검사가 `install` 완료 후 동시에 실행됩니다.

| 검사 | 명령 | 실패 시 |
|------|------|---------|
| Lint | `pnpm run lint` | 경고 (continue-on-error: true) |
| TypeCheck | `pnpm run typecheck` | 파이프라인 중단 |
| Build | `pnpm run build` | 파이프라인 중단 |
| Helm Lint | `helm lint helm/saas-platform/` | 인프라 변경 시만 실행 |

**로컬에서 미리 확인하는 방법**:
```bash
# 루트 디렉토리에서 실행
pnpm run lint
pnpm run typecheck
pnpm run build
```

### 3.5 Step 4: 테스트 (test)

빌드 완료 후 실행됩니다. PostgreSQL 16과 Redis 7 컨테이너가 서비스로 자동 구동됩니다.

**테스트 환경 변수**:
```
DATABASE_URL: postgresql://saas:***@localhost:5432/saas_platform_test
REDIS_URL: redis://localhost:6379
JWT_SECRET: test-jwt-secret (테스트 전용)
NODE_ENV: test
```

**로컬 테스트 실행**:
```bash
# 테스트 DB 준비 (Docker 필요)
docker run -d --name pg-test -p 5432:5432 \
  -e POSTGRES_USER=saas \
  -e POSTGRES_PASSWORD=saas_test_2026 \
  -e POSTGRES_DB=saas_platform_test \
  postgres:16-alpine

docker run -d --name redis-test -p 6379:6379 redis:7-alpine

# 테스트 실행
DATABASE_URL=postgresql://saas:saas_test_2026@localhost:5432/saas_platform_test \
REDIS_URL=redis://localhost:6379 \
JWT_SECRET=test-jwt-secret \
NODE_ENV=test \
pnpm run test
```

### 3.6 Step 5: E2E 테스트 (PR에서만)

PR을 올릴 때만 E2E 통합 테스트가 실행됩니다. 일반 push에서는 실행되지 않습니다.

```bash
# E2E 테스트는 별도 패키지에서 실행
pnpm --filter @public-saas/e2e-tests test
```

### 3.7 Matrix Build: 서비스별 병렬 빌드

`matrix-build.yml`은 변경된 서비스만 Docker 이미지로 빌드합니다.

#### 매트릭스 빌드 병렬화 다이어그램

```mermaid
gantt
  title 서비스 병렬 빌드 (max-parallel: 4)
  dateFormat X
  axisFormat %ss

  section Group 1 (동시 실행)
  api-gateway    :0, 30
  auth-service   :0, 25
  user-service   :0, 20
  tenant-service :0, 22

  section Group 2 (Group 1 완료 후)
  ai-service        :30, 55
  audit-service     :25, 48
  compliance-service :22, 45
  security-service  :25, 50
```

**병렬화 전략 상세**:

| 설정 | 값 | 의미 |
|------|-----|------|
| `max-parallel: 4` | 최대 4개 동시 실행 | 러너 자원 한도 내에서 최적 병렬화 |
| `fail-fast: false` | 개별 실패 격리 | 하나 실패해도 나머지 서비스 계속 빌드 |
| `matrix.service` | detect-changes 출력 | 실제 변경된 서비스만 선별 빌드 (시간 단축) |
| BuildKit GHA 캐시 | 서비스별 `scope` 독립 | 서비스 간 캐시 충돌 없이 레이어 재사용 |

**보안 위반 사례 vs 올바른 패턴**:

| 상황 | 잘못된 패턴 | 올바른 패턴 |
|------|-----------|-----------|
| 이미지 빌드 | root 사용자로 빌드 | `USER node` 비특권 계정 사용 |
| 이미지 태그 | `latest` 고정 태그 사용 | 커밋 SHA 7자리 또는 시맨틱 버전 사용 |
| 외부 의존성 | 빌드 시 인터넷 직접 접근 | 사전 검증된 Harbor 미러 사용 |
| 시크릿 전달 | Dockerfile ARG에 시크릿 하드코딩 | BuildKit `--secret` 또는 ESO 주입 사용 |

**지원 서비스 목록** (16개):
```
api-gateway, auth-service, user-service, tenant-service,
menu-service, catalog-service, subscription-service, billing-service,
crm-service, ai-service, notification-service, file-service,
audit-service, compliance-service, security-service, security-monitor-service
```

**병렬 빌드 설정**:
```yaml
strategy:
  matrix:
    service: ${{ fromJson(needs.detect-changes.outputs.services) }}
  max-parallel: 4  # 최대 4개 동시 빌드
  fail-fast: false  # 하나 실패해도 나머지 계속 빌드
```

### 3.8 pnpm 캐시 전략 (BuildKit 통합)

Docker 이미지 빌드에는 BuildKit GHA 캐시가 사용됩니다.

```yaml
# Docker 레이어 캐시 (서비스별 독립 범위)
cache-from: type=gha,scope=${{ matrix.service }}
cache-to: type=gha,scope=${{ matrix.service }},mode=max
```

**캐시 계층 구조**:
```
L1: pnpm store 캐시 (pnpm-lock.yaml 해시 기반)
L2: Docker BuildKit 레이어 캐시 (서비스별 scope)
L3: Node.js 모듈 레이어 (Dockerfile ADD 순서 최적화)
```

처음 빌드는 느리지만, 이후 변경이 없는 레이어는 캐시에서 즉시 복원됩니다.

---

## 4. Q-Gate 품질 게이트 이해

### 4.1 Q-Gate란

Q-Gate (Quality Gate)는 PR이 `main` 또는 `stg`로 머지되기 전에 자동으로 실행되는 7단계 품질 검증 시스템입니다. `CLAUDE.md §6`에 정의되어 있으며, `quality-gate.yml`에 구현되어 있습니다.

```
G1: 요구사항 FR ID 전수   ← Plan 문서 검증
G2: 설계 완전성           ← Design 문서 검증 (Auditor)
G3: 코드 품질 + AgentShield  ← ESLint + TypeScript
G4: 테스트 커버리지 80%+  ← Jest coverage
G5: OWASP Top10 통과      ← 시크릿 + SQL 주입 패턴 검사
G6: CSAP 해당 Phase 100%  ← Auditor 검증
G7: 감사 추적 완비        ← .claude/audit.jsonl 확인
```

### 4.2 각 게이트 상세 설명

**G1: FR ID 전수 검증**

`docs/01-plan/mtus/*.plan.md` 파일에서 `FR-{모듈}.{번호}` 형식의 요구사항 ID를 확인합니다. Plan 문서가 없거나 FR ID가 0개이면 경고가 발생합니다.

실무 의미: "구현 착수 전 Plan 문서가 반드시 존재해야 한다"는 프로젝트 원칙의 자동 시행입니다.

**G3: 코드 품질**

TypeScript 타입 오류와 ESLint 규칙 위반을 검사합니다. TypeCheck 실패는 즉시 파이프라인을 중단시킵니다. Lint는 `continue-on-error: true`이지만 보고서에 기록됩니다.

**G4: 테스트 커버리지**

`coverage/coverage-summary.json`에서 라인 커버리지를 읽어 80% 미만이면 경고를 발생시킵니다. 커버리지 리포트가 없으면 WARN으로 처리됩니다.

**G5: OWASP Top10**

두 가지 자동 패턴 검사를 수행합니다:

1. 하드코딩 시크릿 탐지: `sk-[a-zA-Z0-9]{20,}`, `PRIVATE.KEY` 패턴
2. SQL 직접 결합 탐지: `SELECT.*FROM.*${`, `INSERT.*INTO.*${` 패턴

테스트 파일(`.test.`, `.spec.`)은 검사에서 제외됩니다.

**G7: 감사 로그 확인**

`.claude/audit.jsonl` 파일이 존재하고 유효한 JSON 형식인지 확인합니다. 파일이 없으면 G7이 실패하여 PR 머지가 차단됩니다.

### 4.3 Q-Gate 실패 시 처리 방법

**G3 또는 G5 실패**: 필수 게이트이므로 PR 머지가 차단됩니다.

```bash
# G3 실패 시 로컬 확인
pnpm run typecheck  # TypeScript 오류 목록 확인
pnpm run lint       # ESLint 오류 목록 확인

# G5 실패 시 점검
grep -rn "sk-" platform/ --include="*.ts"  # API 키 패턴 확인
grep -rn 'SELECT.*FROM.*${' platform/ --include="*.ts"  # SQL 결합 확인
```

**G4 실패** (커버리지 80% 미만): 경고이지만 테스트 보완을 권고합니다.

```bash
# 커버리지 리포트 생성
pnpm run test -- --coverage
# 결과 확인: coverage/lcov-report/index.html
```

**G7 실패** (audit.jsonl 없음): `.claude/audit.jsonl` 파일을 생성하거나 최신화합니다.

```bash
# audit.jsonl 존재 여부 확인
ls -la .claude/audit.jsonl

# 직접 엔트리 추가 (필요 시)
echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","actor":"developer","action":"MANUAL_AUDIT_ENTRY"}' >> .claude/audit.jsonl
```

### 4.4 Q-Gate 완전 통과 기준

```
qgate-summary 결과:
  G1 FR 전수:      success
  G3 코드 품질:    success  ← 필수
  G4 테스트 80%+:  success (또는 warning)
  G5 OWASP Top10:  success  ← 필수
  G7 감사 로그:    success  ← 필수
```

---

## 5. DevSecOps 파이프라인

### 5.1 개요

`devsecops.yml`은 "Shift-Left Security" 원칙을 구현합니다. 보안 검사를 배포 직전이 아닌 코드 작성 단계부터 수행합니다.

**실행 시점**: `main`, `stg` 브랜치 push + PR + 매일 02:00 KST (17:00 UTC) 정기 실행

#### DevSecOps 보안 검사 파이프라인 다이어그램

```mermaid
flowchart LR
  CODE[소스코드] --> SEMGREP[Semgrep 정적분석\np/owasp-top-ten\np/typescript]
  IMAGE[Docker 이미지] --> TRIVY[Trivy 취약점 스캔\nHIGH·CRITICAL]
  REPO[저장소] --> SCORECARD[OpenSSF Scorecard\n브랜치 보호·리뷰 정책]
  IMAGE --> SBOM_GEN[SBOM 생성 - Syft\nCycloneDX 1.6 JSON]
  SBOM_GEN --> GRYPE[Grype 취약점 DB\nSHA256 체크섬 검증]
  IMAGE --> COSIGN[Cosign 서명\nSigstore keyless]
  COSIGN --> SLSA[SLSA Provenance L3\nin-toto 빌드 증명]
```

**구성요소별 역할**:

| 도구 | 입력 | 탐지 대상 | 실패 기준 |
|------|------|----------|---------|
| Semgrep | 소스코드 (`.ts`) | SQL 주입·XSS·시크릿 패턴 | ERROR 등급 발견 시 차단 |
| Trivy IaC | Helm·k8s YAML | 보안 설정 오류 (privileged, root 실행 등) | HIGH/CRITICAL 발견 시 차단 |
| OpenSSF Scorecard | 저장소 메타데이터 | 코드 리뷰 정책·브랜치 보호·토큰 권한 | 점수 기준 경고 |
| Syft + Grype | Docker 이미지 레이어 | 의존성 CVE (pnpm audit 보완) | CRITICAL 발견 시 차단 |
| Cosign | 빌드 완료 이미지 | 이미지 무결성 보장 (서명 첨부) | 서명 실패 시 Kyverno 배포 차단 |
| SLSA Level 3 | 빌드 메타데이터 | 공급망 증명 (커밋 SHA·빌드 시간·환경) | 증명 누락 시 릴리스 차단 |

**보안 위반 사례 vs 올바른 패턴**:

| 위반 유형 | 잘못된 패턴 | 올바른 패턴 | 탐지 도구 |
|---------|-----------|-----------|---------|
| SAST 미적용 | `semgrep` 없이 코드 배포 | PR마다 Semgrep SARIF 리포트 확인 | Semgrep |
| 이미지 서명 없음 | 서명 없는 이미지 Harbor push | `cosign sign` 후 Kyverno 정책 통과 | Cosign + Kyverno |
| 공급망 공격 노출 | 빌드 시 Trivy 바이너리 무검증 다운로드 | SHA256 체크섬 검증 후 사용 | 수동 검증 |
| SBOM 부재 | 의존성 목록 불명확 | CycloneDX SBOM + Grype 스캔 결과 보존 | Syft + Grype |

**5개 검사가 병렬로 실행됩니다**:

```
[1/5] Trivy IaC Scan
[2/5] Semgrep SAST
[3/5] Dependency Audit
[4/5] Secret Scan
[5/5] Kyverno Policy Check
```

### 5.2 [1/5] Trivy IaC 스캔

Helm 차트, k8s 매니페스트, 인프라 설정 파일의 보안 설정 오류를 탐지합니다.

**스캔 대상**:
- `helm/` — Helm 차트
- `deploy/` — k8s YAML 매니페스트
- `infra/` — 인프라 설정 파일

**기준**: HIGH, CRITICAL 등급 취약점

**리포트**: `trivy-iac-report.json` (365일 보존)

**발견 시 조치**:
```bash
# 로컬에서 동일한 스캔 실행
trivy config --severity HIGH,CRITICAL helm/saas-platform/

# 특정 취약점 무시 (충분한 근거가 있는 경우만)
# .trivyignore 파일에 CVE 번호 추가
```

### 5.3 [2/5] Semgrep SAST (정적 코드 분석)

소스 코드의 보안 취약점 패턴을 정적으로 분석합니다.

**적용 규칙셋**:
- `auto` — 언어 감지 후 자동 규칙 적용
- `p/owasp-top-ten` — OWASP Top 10 패턴
- `p/typescript` — TypeScript 전용 보안 규칙

**출력 형식**: SARIF (보안 분석 리포트 표준)

**로컬 실행**:
```bash
# Semgrep 설치
pip install semgrep

# 전체 스캔
semgrep scan --config auto --config "p/owasp-top-ten" platform/

# 특정 파일만 스캔
semgrep scan --config auto platform/services/auth-service/src/
```

**일반적인 발견 패턴**:
- SQL 쿼리 문자열 직접 결합
- 검증 없는 사용자 입력 사용
- 안전하지 않은 정규식 (ReDoS)
- 불충분한 암호화 알고리즘

### 5.4 [3/5] 의존성 취약점 감사

`pnpm audit`을 통해 npm 패키지의 알려진 취약점을 검사합니다.

```bash
# 로컬 실행
pnpm audit --audit-level=high

# JSON 리포트
pnpm audit --json > dependency-audit.json
```

**결과 해석**:
- HIGH/CRITICAL 취약점: 즉시 패키지 업데이트 필요
- MODERATE: 다음 배포 전까지 해결 권고
- LOW: 백로그 등록 후 처리

### 5.5 [4/5] 시크릿 탐지 (Secret Scan)

하드코딩된 API 키, 비밀번호, Private Key를 탐지합니다.

**탐지 패턴**:
```
API 키: sk-[a-zA-Z0-9]{20,}
비밀번호: password = "직접_값"
Private Key: PRIVATE.KEY 문자열
```

**예외**: `process.env.` 참조, 테스트 파일 (`.test.`, `.spec.`), 스키마 정의

**CRITICAL 발견 시**: 파이프라인 즉시 차단 (`CRITICAL_FAIL=true`)

**시크릿을 실수로 커밋한 경우**:
1. 즉시 해당 시크릿 폐기 및 재발급
2. 보안팀 즉시 보고 (CSAP D-06 사고 관리)
3. `git history rewrite` 요청 (보안팀 승인 필요)
4. `.claude/audit.jsonl`에 사고 기록

### 5.6 [5/5] Kyverno 정책 검증

k8s 배포 전 Kyverno 정책으로 사전 검증합니다.

**주요 정책**:
- 이미지 서명 검증 (`verify-image-signature.yaml`)
- Pod Security Standards
- 리소스 요청/제한 필수 설정
- Privileged 컨테이너 금지

### 5.7 SBOM 생성 및 서명 (sbom-scan.yml)

CI 파이프라인 완료 후 자동으로 SBOM(소프트웨어 부품표)을 생성합니다.

**도구**: Syft (SBOM 생성) + Grype (취약점 스캔)

> 참고: 2026년 3월 Trivy 공급망 공격 사건으로 Grype를 채택하였습니다. 모든 바이너리 다운로드 시 SHA256 체크섬을 검증합니다.

**SBOM 형식**:
- CycloneDX 1.6 JSON (주 형식)
- SPDX JSON (보조 형식)

**Cosign Attestation**: SBOM을 이미지에 첨부하여 서명합니다.

```bash
# SBOM 검증 (Harbor에서 이미지 가져온 후)
cosign verify-attestation \
  --key infra/cosign/cosign.pub \
  --type cyclonedx \
  harbor.saas.local/public-saas/auth-service:v1.2.0
```

### 5.8 SLSA Provenance Level 3 (slsa-provenance.yml)

SLSA (Supply-chain Levels for Software Artifacts) Level 3 빌드 증명을 생성합니다.

**SLSA Level 3이란**: 빌드 환경이 에페머럴(임시)이고, 빌드 과정이 서명된 증명으로 추적 가능한 수준입니다.

**증명 내용** (in-toto SLSA Provenance v1):
- 빌드 환경 정보 (Builder ID, OS, Arch)
- 소스 커밋 SHA
- 빌드 시작/완료 시각
- 사용된 워크플로우 경로

**검증 방법**:
```bash
cosign verify-attestation \
  --key infra/cosign/cosign.pub \
  --type slsaprovenance \
  harbor.saas.local/public-saas/auth-service@sha256:{다이제스트}
```

---

## 6. 배포 파이프라인

### 6.1 일반 배포 (deploy.yml)

**트리거**: `main` 또는 `stg` 브랜치 push, 태그 `v*`

**스테이징 배포** (`stg` 브랜치 push):
```yaml
# 적용되는 Helm values 파일
values-stg.yaml
release: saas-stg
```

**프로덕션 배포** (태그 `v1.2.3` 형식):
```yaml
# 적용되는 Helm values 파일
values-prod.yaml
release: saas-prod
```

**배포 프로세스**:
1. 16개 서비스 Docker 이미지 병렬 빌드 (matrix 전략)
2. Harbor 레지스트리에 push
3. Helm upgrade --install (10분 타임아웃)
4. 배포 감사 로그 기록 (CSAP D-06)

### 6.2 이미지 태그 규칙

```bash
# 브랜치 push (main/stg)
sha-abc1234   # 커밋 SHA 7자리

# 태그 push (v*)
v1.2.3        # 시맨틱 버전
```

### 6.3 GitOps 자동 배포 (Flux)

Release Pipeline v2에서는 Flux ImagePolicy를 통한 GitOps 방식을 사용합니다.

```bash
# 스테이징: Flux가 Harbor의 새 이미지를 자동으로 감지하여 배포
# Flux ImagePolicy가 stg-* 태그 패턴을 모니터링
```

### 6.4 Argo Rollouts 카나리 배포

프로덕션 배포는 Argo Rollouts를 통한 카나리 배포를 사용합니다.

**카나리 배포 단계**:
```
10% → (5분 대기 + 메트릭 확인) → 50% → (10분 대기) → 100%
```

#### 카나리 배포 전략 다이어그램

```mermaid
flowchart LR
  RELEASE[신규 버전\nv1.3.0] --> CANARY[카나리 10%\n5분 대기]
  CANARY --> METRIC{에러율 < 1%?\nSLO 에러버짓 잔여?}
  METRIC -->|Yes| STEP2[50% 트래픽\n10분 대기]
  STEP2 --> METRIC2{안정적?\nP99 레이턴시 정상?}
  METRIC2 -->|Yes| FULL[100% 배포 완료\nDORA 성공 기록]
  METRIC -->|No| ROLLBACK[자동 롤백\nargo rollouts abort]
  METRIC2 -->|No| ROLLBACK
  ROLLBACK --> AUDIT[감사 로그 기록\nROLLBACK_TRIGGERED]
```

**카나리 단계별 판정 기준**:

| 단계 | 트래픽 비율 | 대기 시간 | 판정 메트릭 | 실패 조치 |
|------|-----------|---------|-----------|---------|
| Step 1 | 10% | 5분 | 에러율 < 1%, SLO 에러버짓 잔여 | 즉시 자동 롤백 |
| Step 2 | 50% | 10분 | P99 레이턴시 < 500ms, 에러율 < 0.5% | 즉시 자동 롤백 |
| Step 3 | 100% | - | 배포 완료 후 DORA 성공 이벤트 기록 | - |

**보안 위반 사례 vs 올바른 패턴**:

| 상황 | 잘못된 패턴 | 올바른 패턴 |
|------|-----------|-----------|
| 롤백 판단 | 운영자 수동 판단에만 의존 | SLO 에러버짓 기반 자동 롤백 |
| 감사 추적 | 롤백 후 이유 미기록 | `ROLLBACK_TRIGGERED` 감사 로그 + 사후 분석 |
| 트래픽 이동 | 한번에 100% 전환 | 10% → 50% → 100% 단계적 확대 |

**SLO 기반 자동 롤백**: SLO 에러 버짓 소진 시 자동으로 이전 버전으로 롤백됩니다.

### 6.5 수동 롤백 방법

**Helm 롤백** (긴급 상황):
```bash
# 현재 배포 이력 확인
helm history saas-prod --namespace saas-platform

# 이전 버전으로 롤백
helm rollback saas-prod {REVISION} --namespace saas-platform

# 감사 로그 기록 (필수)
echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","actor":"'$(whoami)'","action":"MANUAL_ROLLBACK","namespace":"saas-platform","reason":"설명"}' >> .claude/audit.jsonl
```

**Argo Rollouts 롤백**:
```bash
# 롤아웃 상태 확인
kubectl argo rollouts get rollout {서비스명} -n saas-platform

# 즉시 중단 (카나리 → 이전 버전)
kubectl argo rollouts abort {서비스명} -n saas-platform
```

---

## 7. DORA 게이트

### 7.1 DORA Four Keys란

DORA (DevOps Research and Assessment) Four Keys는 소프트웨어 개발팀의 성과를 측정하는 4개 지표입니다.

| 지표 | 설명 | 목표 (Elite) |
|------|------|-------------|
| 배포 빈도 (DF) | 얼마나 자주 프로덕션 배포하는가 | 하루 여러 번 |
| 리드타임 (LT) | 코드 커밋 → 프로덕션 도달 시간 | 1시간 미만 |
| 변경 실패율 (CFR) | 배포 중 얼마나 자주 실패하는가 | 5% 미만 |
| 평균 복구 시간 (MTTR) | 장애 발생 후 복구까지 걸리는 시간 | 1시간 미만 |

### 7.2 DORA 게이트 판정 기준 (dora-gate.yml)

배포 전 변경 실패율(CFR)을 확인하여 자동으로 판정합니다.

| CFR 범위 | 판정 | 동작 |
|---------|------|------|
| 0% ~ 15% | PASS | 배포 허용 + DORA 이벤트 기록 |
| 15% ~ 30% | WARN | 경고 + 수동 승인 요구 |
| 30% 초과 | BLOCK | 배포 차단 (DORA Low 등급) |

**메트릭 조회 소스**: Prometheus (`dora:change_failure_rate:ratio` 메트릭)

#### DORA 메트릭 게이트 판정 흐름 다이어그램

```mermaid
flowchart TD
  START[배포 요청] --> QUERY[Prometheus 쿼리\ndora:change_failure_rate:ratio]
  QUERY --> CFR_CHECK{CFR 계산}

  CFR_CHECK -->|CFR 0~15%\nElite 등급| PASS[PASS\n배포 허용]
  CFR_CHECK -->|CFR 15~30%\nHigh 등급 경계| WARN[WARN\n팀 리드 수동 승인]
  CFR_CHECK -->|CFR 30% 초과\nLow 등급| BLOCK[BLOCK\n배포 즉시 차단]

  PASS --> DORA_RECORD[DORA 이벤트 기록\ndeployment_frequency +1]
  WARN --> MANUAL{팀 리드 승인?}
  MANUAL -->|승인| DORA_RECORD
  MANUAL -->|거부| BLOCK
  BLOCK --> AUDIT_LOG[감사 로그 기록\nDEPLOY_BLOCKED]
  AUDIT_LOG --> RCA[근본 원인 분석\nRCA 문서 작성]
```

**DORA Four Keys 기준값 (산업 벤치마크)**:

| 지표 | Elite | High | Medium | Low |
|------|-------|------|--------|-----|
| 배포 빈도 (DF) | 하루 여러 번 | 하루 1회 ~ 주 1회 | 주 1회 ~ 월 1회 | 월 1회 미만 |
| 리드타임 (LT) | 1시간 미만 | 1일 미만 | 1주 미만 | 1개월 이상 |
| 변경 실패율 (CFR) | **15% 미만** | **15~30%** | 30~45% | **45% 초과** |
| 평균 복구 시간 (MTTR) | 1시간 미만 | 1일 미만 | 1주 미만 | 1개월 이상 |

> 본 프로젝트 CFR 게이트: **15% WARN, 30% BLOCK** (DORA High~Elite 수준 유지 목표)

**보안 위반 사례 vs 올바른 패턴**:

| 상황 | 잘못된 패턴 | 올바른 패턴 |
|------|-----------|-----------|
| BLOCK 무시 | CFR > 30%에도 수동 배포 강행 | BLOCK 시 RCA 완료 후 재시도 |
| 메트릭 조작 | 실패 이벤트 미기록으로 CFR 낮춤 | 배포 성공/실패 전수 기록 |
| 감사 추적 | BLOCK 사유 미기록 | `DEPLOY_BLOCKED` + CFR 값 감사 로그 기록 필수 |

### 7.3 DORA 게이트 기준 미달 시 처리

**WARN (15~30%) 발생 시**:
1. 팀 리드에게 통보
2. 최근 실패 배포 원인 분석
3. 수동 승인 후 배포 진행 가능

**BLOCK (30% 초과) 발생 시**:
1. 배포 즉시 차단 (audit.jsonl에 DEPLOY_BLOCKED 기록)
2. 최근 실패한 배포의 근본 원인 분석 (RCA)
3. 실패율 개선 조치 후 재시도
4. 보안팀 및 PM에게 상황 보고

**현재 DORA 메트릭 확인 방법**:
```bash
# Prometheus 직접 쿼리
curl -s "http://prometheus.monitoring.svc:9090/api/v1/query?query=dora:change_failure_rate:ratio" | jq '.data.result'

# DORA Exporter 패키지를 통한 확인
# packages/dora-exporter/src/index.ts 참조
```

---

## 8. 핫픽스 프로세스

### 8.1 핫픽스가 필요한 상황

핫픽스는 다음 상황에서만 사용합니다:
- 프로덕션 장애 (서비스 중단)
- 심각한 보안 취약점 (CRITICAL 등급)
- 데이터 무결성 위협

일반 버그 수정은 `fix/` 브랜치를 통한 일반 PR 프로세스를 따릅니다.

### 8.2 hotfix-pipeline.yaml 흐름

`hotfix/**` 브랜치에 push하면 자동으로 실행됩니다.

#### 핫픽스 긴급 프로세스 시퀀스 다이어그램

```mermaid
sequenceDiagram
  participant LEAD as 팀 리드
  participant GIT as Gitea
  participant HOTFIX as hotfix-pipeline
  participant STG as Staging
  participant PROD as Production

  LEAD->>GIT: hotfix/urgent-fix 브랜치 push
  GIT->>HOTFIX: hotfix 파이프라인 자동 트리거
  HOTFIX->>HOTFIX: Stage 1 - 핵심 테스트만 실행\n(typecheck + unit test)
  HOTFIX->>HOTFIX: Stage 2 - 보안 스캔\n(Trivy CRITICAL/HIGH + Cosign)
  HOTFIX->>STG: Stage 3 - 스테이징 배포\n(replicas=1 + 스모크 테스트)
  STG-->>HOTFIX: 스모크 테스트 결과
  HOTFIX->>LEAD: Stage 4 - 프로덕션 수동 승인 요청\n(보안팀 + 팀 리드)
  LEAD->>HOTFIX: 수동 승인
  HOTFIX->>PROD: 프로덕션 즉시 배포
  PROD-->>HOTFIX: 배포 결과 확인
  HOTFIX->>GIT: 감사 로그 기록\n(HOTFIX_DEPLOY)
  LEAD->>GIT: main + stg 브랜치로 백포트
```

**핫픽스 vs 일반 배포 비교**:

| 항목 | 일반 배포 | 핫픽스 배포 |
|------|---------|-----------|
| 브랜치 | `feat/*`, `fix/*` | `hotfix/*` 필수 |
| E2E 테스트 | 전체 실행 | 생략 (긴급 상황) |
| Q-Gate | G1~G7 전체 | 핵심 보안 스캔만 |
| 프로덕션 승인 | 자동 (카나리) | 수동 승인 필수 (보안팀 + 팀 리드) |
| 감사 로그 | 표준 DEPLOY | `HOTFIX_DEPLOY` 별도 기록 |

**보안 위반 사례 vs 올바른 패턴**:

| 상황 | 잘못된 패턴 | 올바른 패턴 |
|------|-----------|-----------|
| 긴급 배포 남용 | 일반 버그 수정에 hotfix 사용 | 프로덕션 장애·CRITICAL 취약점만 hotfix 적용 |
| 승인 우회 | 수동 승인 없이 프로덕션 배포 | 보안팀 + 팀 리드 2인 승인 필수 |
| 백포트 누락 | hotfix 브랜치만 배포 후 방치 | 배포 완료 후 반드시 main + stg 백포트 |
| 사후 분석 생략 | 핫픽스 후 원인 분석 없음 | Post-Mortem 문서 + 재발 방지 이슈 등록 |

```
Stage 1: 빌드 + 테스트
  └── lint (continue-on-error)
  └── typecheck (필수)
  └── unit test
  └── Docker 이미지 빌드
      │
      ▼
Stage 2: 보안 스캔
  └── Trivy 이미지 스캔 (CRITICAL/HIGH, exit-code 1)
  └── SBOM 생성
  └── Cosign 서명
      │
      ▼
Stage 3: 스테이징 배포
  └── Helm upgrade (staging, replicas=1)
  └── Smoke Test 실행
  └── 실패 시 스테이징 자동 롤백
      │
      ▼
Stage 4: 프로덕션 배포 (수동 승인 게이트)
  └── environment: production (수동 승인 필요)
  └── hotfix-deploy.sh 실행
  └── 배포 후 검증
  └── 실패 시 자동 롤백 (hotfix-rollback.sh)
  └── 감사 로그 기록
```

### 8.3 긴급 배포 절차

```bash
# 1. 핫픽스 브랜치 생성 (반드시 hotfix/ 접두사)
git checkout main
git pull origin main
git checkout -b hotfix/critical-auth-bypass

# 2. 수정 작업
# ... 코드 수정 ...

# 3. 커밋
git add platform/services/auth-service/src/
git commit -m "fix(auth): CRITICAL 인증 우회 취약점 수정

- JWT 검증 로직 null 처리 추가
- CSAP D-08 접근 통제 요건 강화

FR: SEC-HOTFIX-001"

# 4. push (hotfix 파이프라인 자동 시작)
git push origin hotfix/critical-auth-bypass

# 5. Gitea Actions에서 파이프라인 진행 상황 모니터링
# 6. 프로덕션 배포 단계에서 수동 승인 (보안팀 + 팀 리드)
# 7. 배포 완료 후 main + stg 브랜치에 hotfix 머지
```

### 8.4 핫픽스 후속 처리

1. hotfix → stg 머지 (일반 PR 프로세스)
2. hotfix → main 머지
3. CHANGELOG.md 업데이트
4. 사후 분석 (Post-Mortem) 문서 작성
5. 재발 방지 조치 이슈 등록

---

## 9. 실습: 내 변경사항을 프로덕션까지

### 9.1 전체 개발 흐름 체험

이 실습은 신규 기능을 개발하고 프로덕션까지 배포하는 전체 과정을 안내합니다.

**시나리오**: `user-service`에 사용자 프로필 조회 API 추가

### Step 1: 환경 준비

```bash
# 저장소 클론 (처음 한 번만)
git clone git@gitea.saas.local:public-saas/ai-saas.git
cd ai-saas

# 의존성 설치
pnpm install --frozen-lockfile

# 로컬 환경 변수 설정
cp docs/env.example .env.local
# .env.local 편집 (하드코딩 금지 - 환경 변수 사용)
```

### Step 2: 기능 브랜치 생성

```bash
git checkout stg
git pull origin stg
git checkout -b feat/user-profile-endpoint
```

### Step 3: 코드 작성 (보안 원칙 준수)

```typescript
// platform/services/user-service/src/routes/profile.ts
// Design Ref: §user-profile — Zod 검증 + RBAC 필수
// Plan SC: FR-U.5

import { z } from 'zod'
import { verifyToken, hasPermission } from '@/lib/auth'
import { auditLog } from '@/lib/audit'

const profileParamsSchema = z.object({
  userId: z.string().uuid(),
})

export async function GET(req: Request, { params }: { params: { userId: string } }) {
  // RBAC 검사 (CSAP D-08)
  const user = await verifyToken(req.headers.get('authorization') ?? '')
  if (!hasPermission(user, 'user:read')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 입력 검증 (CSAP D-12)
  const validated = profileParamsSchema.parse(params)

  // 감사 로그 (CSAP D-06)
  await auditLog({
    actor: user.id,
    action: 'USER_PROFILE_READ',
    target: validated.userId,
    timestamp: new Date().toISOString(),
  })

  // 비즈니스 로직 (파라미터화 쿼리)
  const profile = await db.execute(
    'SELECT id, name, email FROM users WHERE id = $1',
    [validated.userId]
  )

  return Response.json(profile)
}
```

### Step 4: 로컬 검증

```bash
# 타입 검사
pnpm run typecheck

# 린트
pnpm run lint

# 테스트 (커버리지 80% 이상 유지)
pnpm run test -- --coverage

# 빌드 확인
pnpm run build
```

### Step 5: 커밋 및 Push

```bash
git add platform/services/user-service/src/routes/profile.ts
git add platform/services/user-service/src/routes/profile.test.ts

git commit -m "feat(user): FR-U.5 사용자 프로필 조회 API 추가

- Zod 스키마 입력 검증 적용 (D-12)
- RBAC 권한 검사 포함 (D-08)
- 감사 로그 기록 (D-06)
- 파라미터화 쿼리 사용 (SQL 주입 방지)"

git push origin feat/user-profile-endpoint
```

### Step 6: PR 생성 및 검토

Gitea 저장소에서 `feat/user-profile-endpoint` → `stg` PR 생성

자동으로 시작되는 파이프라인:
- CI (lint/typecheck/build/test/e2e)
- Q-Gate (G1~G7)
- DevSecOps (Trivy/Semgrep/Secret Scan)

**PR 통과 기준**: G3 (코드 품질), G5 (OWASP), G7 (감사 로그) 필수 통과

### Step 7: 스테이징 배포 확인

PR 머지 후 `stg` 브랜치에 push되면 자동으로 스테이징에 배포됩니다.

```bash
# 스테이징 배포 상태 확인
helm status saas-stg --namespace saas-platform

# 서비스 로그 확인
kubectl logs -l app=user-service -n saas-platform --tail=50
```

### Step 8: 프로덕션 배포

스테이징에서 검증 완료 후 팀 리드가 `stg` → `main` PR을 생성하고 태그를 붙입니다.

```bash
# 팀 리드가 수행
git tag -a v1.3.0 -m "Release v1.3.0: 사용자 프로필 조회 API"
git push origin v1.3.0
# Release Pipeline v2 자동 실행
```

---

## 부록: 자주 발생하는 파이프라인 오류

| 오류 | 원인 | 해결 방법 |
|------|------|----------|
| `pnpm install frozen lockfile` | pnpm-lock.yaml 불일치 | `pnpm install` 로컬 실행 후 lockfile 커밋 |
| `TypeScript error` | 타입 오류 | `pnpm run typecheck` 로컬 실행 후 수정 |
| `G5 OWASP 실패` | 시크릿 또는 SQL 패턴 | 해당 파일에서 패턴 제거 |
| `G7 audit.jsonl 없음` | audit.jsonl 미존재 | 파일 생성 확인 |
| `Harbor push 실패` | 레지스트리 인증 | `secrets.HARBOR_USERNAME/PASSWORD` 확인 |
| `Helm timeout` | k8s 리소스 부족 | 노드 상태 확인, 리소스 요청/제한 조정 |
| `DORA BLOCK` | CFR > 30% | 최근 실패 배포 원인 분석 후 재시도 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 (실제 워크플로우 파일 기반) | Implementer Agent |
| 1.1.0 | 2026-04-11 | Mermaid 다이어그램 6종 추가: 전체 파이프라인 플로우·매트릭스 빌드·DevSecOps·카나리 배포·DORA 게이트·핫픽스 시퀀스. 각 섹션 보안 위반 사례 vs 올바른 패턴 대조표 추가 | Implementer Agent |
