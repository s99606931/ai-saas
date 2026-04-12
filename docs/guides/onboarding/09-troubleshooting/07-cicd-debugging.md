# CI/CD 파이프라인 디버깅 완전 가이드

> **문서 ID**: ONBOARD-09-TROUBLE-07
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **대상**: 개발자, DevOps 엔지니어
> **선행 학습**:
>   - `../06-cicd/pipelines/01-ci-walkthrough.md` — CI 파이프라인 전체 흐름
>   - `../06-cicd/pipelines/02-quality-gate.md` — Q-Gate 7단계 상세 이해
>   - `01-common-errors.md` — 자주 발생하는 기본 오류
>   - `../06-cicd/09-environment-promotion.md` — 환경 승격 프로세스
> **소요 시간**: 약 120분
> **CSAP**: D-06 (침해사고 관리 — CI/CD 이력 보존), D-12 (시스템 개발 보안 — 빌드 보안)
> **Design Ref**: MTU-N244 §3, MTU-N246 §3.5, MTU-N250 §3
> **Plan SC**: FR-N244.1~FR-N244.5, FR-N246.1~FR-N246.6, FR-N250.1~FR-N250.4

---

## 목차

1. [CI/CD 파이프라인 디버깅 접근법](#1-cicd-파이프라인-디버깅-접근법)
2. [빌드 실패 디버깅](#2-빌드-실패-디버깅)
3. [테스트 실패 디버깅](#3-테스트-실패-디버깅)
4. [보안 게이트 실패 디버깅](#4-보안-게이트-실패-디버깅)
5. [배포 실패 디버깅](#5-배포-실패-디버깅)
6. [DORA 게이트 차단 처리](#6-dora-게이트-차단-처리)
7. [실전 CI/CD 디버깅 시나리오](#7-실전-cicd-디버깅-시나리오)
8. [CI/CD 로그 보존 및 CSAP](#8-cicd-로그-보존-및-csap)
9. [학습 체크리스트](#9-학습-체크리스트)

---

## 1. CI/CD 파이프라인 디버깅 접근법

### 1.1 Gitea Actions 로그 읽는 방법

Gitea Actions는 GitHub Actions와 동일한 인터페이스를 사용합니다. 로그를 효율적으로 읽는 방법을 익혀두면 디버깅 시간이 크게 줄어듭니다.

**로그 접근 방법**:
```
Gitea UI:
  저장소 → Actions 탭 → 실패한 워크플로우 클릭
  → 실패한 Job 클릭
  → 실패한 Step 클릭 (빨간 X 표시)
  → 로그 펼치기
```

**로그에서 중요한 부분 찾기**:

```
# Gitea Actions 로그 구조 (예시)

2026-04-12T09:00:00Z - [INFO] Run lint
2026-04-12T09:00:01Z   > pnpm run lint
2026-04-12T09:00:05Z
2026-04-12T09:00:05Z   /home/runner/work/ai-saas/platform/services/auth-service/src/handlers/auth.handler.ts
2026-04-12T09:00:05Z     52:15  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
2026-04-12T09:00:05Z     89:3   error  Promise-returning function provided to attribute where a void return was expected
2026-04-12T09:00:05Z
2026-04-12T09:00:05Z   2 errors, 0 warnings
2026-04-12T09:00:05Z
2026-04-12T09:00:05Z - [FAIL] lint (exit code: 1)  ← 이 줄이 실패 원인
                                                         ↑
                                          파일 경로와 줄 번호를 먼저 찾으십시오
```

**빠른 실패 지점 찾기**:
```bash
# API를 통해 특정 Run 로그 조회 (Gitea CLI 사용 시)
gitea actions list --repo your-org/ai-saas --limit 10

# 로그를 로컬로 다운로드
gitea actions download-log --run-id 12345 --job lint
```

### 1.2 단계별 실패 원인 분류

CI 실패는 크게 4가지 카테고리로 분류됩니다.
어느 카테고리인지 먼저 파악하면 디버깅 방향이 명확해집니다.

```
실패 Job 이름       → 카테고리        → 이 문서 참고 섹션
lint / typecheck    → 빌드 실패       → §2
test / coverage     → 테스트 실패     → §3
semgrep / trivy     → 보안 게이트 실패 → §4
helm-deploy / flux  → 배포 실패       → §5
dora-gate           → DORA 차단       → §6
```

### 1.3 CI 실패 원인 진단 트리

```mermaid
flowchart TD
    START[CI 파이프라인 실패 감지]

    Q1{어느 Job에서 실패했는가?}

    subgraph BUILD["빌드 계층"]
        B1[lint / typecheck]
        B2[build]
        B3[helm-lint]
    end

    subgraph TEST["테스트 계층"]
        T1[test / coverage]
        T2[e2e]
    end

    subgraph SEC["보안 계층"]
        S1[g5-owasp / semgrep]
        S2[trivy-iac / trivy-image]
        S3[secret-scan]
    end

    subgraph DEPLOY["배포 계층"]
        D1[helm-deploy]
        D2[flux / flagger]
        D3[dora-gate]
    end

    START --> Q1
    Q1 --> BUILD
    Q1 --> TEST
    Q1 --> SEC
    Q1 --> DEPLOY

    B1 --> FIX_CODE[코드 수정\n→ §2.1 참고]
    B2 --> FIX_DEP[의존성/환경 문제\n→ §2.2 참고]
    B3 --> FIX_HELM[Helm 차트 문제\n→ §5.4 참고]

    T1 --> FIX_TEST[테스트 코드 수정\n또는 커버리지 보강\n→ §3 참고]
    T2 --> FIX_E2E[E2E 환경 문제\n→ §3.3 참고]

    S1 --> CHECK_FP[오탐 여부 판단\n→ §4.1 참고]
    S2 --> PATCH[취약점 패치\n또는 억제 정책\n→ §4.2 참고]
    S3 --> REMOVE_SECRET[하드코딩 시크릿 제거\n→ §4.3 참고]

    D1 --> FIX_HELM2[Helm 설정 확인\n→ §5.1 참고]
    D2 --> CHECK_FLUX[Flux/Flagger 상태 확인\n→ §5.2 참고]
    D3 --> DORA_FIX[CFR 개선 후 재시도\n→ §6 참고]

    style BUILD fill:#e3f2fd
    style TEST fill:#e8f5e9
    style SEC fill:#fff3e0
    style DEPLOY fill:#fce4ec
```

### 1.4 로컬에서 CI 단계 재현 방법

CI 환경에서만 발생하는 문제는 로컬에서 재현이 어렵습니다.
하지만 아래 방법으로 CI와 최대한 유사한 환경을 만들 수 있습니다.

```bash
# CI와 동일한 명령어로 로컬 실행
# (ci.yml의 steps를 그대로 로컬에서 순서대로 실행)

# 1. 의존성 설치 (ci.yml과 동일)
pnpm install --frozen-lockfile

# 2. 타입 체크 (ci.yml의 typecheck step)
pnpm run typecheck

# 3. 린트 (ci.yml의 lint step)
pnpm run lint

# 4. 빌드 (ci.yml의 build step)
pnpm run build

# 5. 테스트 (ci.yml의 test step)
DATABASE_URL=postgresql://saas:saas_test_2026@localhost:5432/saas_platform_test \
REDIS_URL=redis://localhost:6379 \
JWT_SECRET=test-jwt-secret \
NODE_ENV=test \
pnpm run test -- --coverage

# CI와 다를 수 있는 조건들:
# - Node.js 버전: CI는 22.x, 로컬은 다를 수 있음
#   → nvm use 22 로 맞추기
# - pnpm 버전: CI는 9.15.0
#   → npm install -g pnpm@9.15.0
# - OS: CI는 ubuntu-latest / self-hosted
```

---

## 2. 빌드 실패 디버깅

### 2.1 TypeScript 컴파일 오류 패턴 10개

TypeScript 오류는 오류 코드(TS2XXX)로 원인을 바로 파악할 수 있습니다.

**패턴 1: `TS2345` — 타입 불일치**
```
오류 메시지:
Argument of type 'string | undefined' is not assignable to parameter of type 'string'.

원인: undefined가 될 수 있는 값을 string으로 사용

해결:
// 잘못된 코드
const tenantId = req.headers['x-tenant-id'];  // string | undefined
doSomething(tenantId);  // TS2345

// 올바른 코드
const tenantId = req.headers['x-tenant-id'] as string;
if (!tenantId) throw new Error('x-tenant-id 헤더 누락');
doSomething(tenantId);
```

**패턴 2: `TS2339` — 존재하지 않는 프로퍼티**
```
오류 메시지:
Property 'xyz' does not exist on type 'MyType'.

원인: 타입 정의에 없는 프로퍼티 접근

해결:
// 타입 정의 확인 후 프로퍼티 추가
interface MyType {
  xyz: string;  // 추가
}
```

**패턴 3: `TS2307` — 모듈을 찾을 수 없음**
```
오류 메시지:
Cannot find module '@public-saas/audit-sdk' or its corresponding type declarations.

원인: 패키지 빌드 순서 문제 또는 pnpm workspace 설정 오류

해결:
# 워크스페이스 패키지 먼저 빌드
pnpm --filter '@public-saas/audit-sdk' build
# 또는
pnpm run build --filter='./packages/**'
```

**패턴 4: `TS7006` — 암묵적 any**
```
오류 메시지:
Parameter 'e' implicitly has an 'any' type.

원인: 타입 선언 없는 파라미터

해결:
// 잘못된 코드
catch (e) { console.log(e.message); }  // TS7006

// 올바른 코드
catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  console.log(message);
}
```

**패턴 5: `TS2304` — 이름을 찾을 수 없음**
```
오류 메시지:
Cannot find name 'Buffer'.

원인: Node.js 전역 타입이 tsconfig에서 누락

해결:
// tsconfig.json
{
  "compilerOptions": {
    "types": ["node"]  // @types/node 추가
  }
}
```

**패턴 6: `TS2531` — null 가능성**
```
오류 메시지:
Object is possibly 'null'.

원인: strictNullChecks가 활성화된 상태에서 null 체크 없음

해결:
const element = document.getElementById('myId');
if (!element) return;  // null 체크 후 사용
element.classList.add('active');
```

**패턴 7: `TS2554` — 인수 수 불일치**
```
오류 메시지:
Expected 2 arguments, but got 1.

원인: 함수 시그니처 변경 후 호출부 미수정

해결:
# 함수 정의 확인 후 호출부 수정
# 또는 파라미터를 선택적으로 변경: param?: Type
```

**패턴 8: `TS2322` — 타입 할당 불가**
```
오류 메시지:
Type '"active" | "inactive"' is not assignable to type 'Status'.

원인: 리터럴 타입과 enum/union 타입 불일치

해결:
// as const 또는 명시적 타입 캐스팅 사용
const status = 'active' as Status;
```

**패턴 9: `TS1005` — 예상치 못한 토큰 (대부분 구문 오류)**
```
오류 메시지:
'{' expected.

원인: 문법 오류 (괄호 미닫기, 쉼표 오류 등)

해결: 오류가 발생한 줄의 앞뒤 줄을 확인
```

**패턴 10: `TS2571` — 알 수 없는 타입**
```
오류 메시지:
Object is of type 'unknown'.

원인: try-catch의 error는 TypeScript 4.4+부터 unknown 타입

해결:
catch (error: unknown) {
  const message = error instanceof Error
    ? error.message
    : '알 수 없는 오류';
  logger.error(message);
}
```

### 2.2 pnpm 의존성 충돌 해결

```bash
# 오류 메시지 예시
# ERROR  Cannot find module 'some-package'
# ERROR  peer dependencies conflict

# 진단: 의존성 트리 확인
pnpm list --depth=3 | grep "some-package"

# 해결 방법 1: 락파일 재생성
rm pnpm-lock.yaml
pnpm install

# 해결 방법 2: 특정 패키지 강제 재설치
pnpm install --force some-package

# 해결 방법 3: pnpm store 클린
pnpm store prune
pnpm install --frozen-lockfile

# CI에서 의존성 충돌 시 (frozen-lockfile 오류)
# "ERR_PNPM_FROZEN_LOCKFILE: The lockfile would have been modified by this install"
# 원인: 로컬에서 pnpm-lock.yaml을 업데이트하지 않고 push
# 해결: 로컬에서 pnpm install 후 pnpm-lock.yaml 커밋
git add pnpm-lock.yaml
git commit -m "fix: pnpm-lock.yaml 동기화"
```

### 2.3 Turbo 캐시 무효화 문제

```bash
# 오류 상황: CI에서 "이미 빌드된" 결과가 잘못된 캐시를 참조

# 진단: Turbo 캐시 상태 확인
pnpm exec turbo run build --dry-run

# 해결 방법 1: 로컬 Turbo 캐시 삭제
rm -rf .turbo/
pnpm run build

# 해결 방법 2: CI Actions 캐시 무효화
# Gitea 또는 GitHub Actions UI → Actions → Cache → 해당 캐시 삭제

# 해결 방법 3: 캐시 키 변경 (ci.yml 수정 없이)
# pnpm-lock.yaml 파일을 공백 1개 수정 후 push
# → hashFiles('**/pnpm-lock.yaml')가 변경되어 캐시 갱신

# 영구 해결: turbo.json에서 outputs 명확히 지정
# turbo.json
{
  "tasks": {
    "build": {
      "outputs": ["dist/**", ".next/**"],
      "inputs": ["src/**", "package.json", "tsconfig.json"]
    }
  }
}
```

### 2.4 Docker 빌드 캐시 문제

```bash
# 오류 메시지 예시
# => ERROR [build 3/5] RUN pnpm install --frozen-lockfile
# The lockfile would have been modified by this install

# 진단: Docker 이미지 빌드 로그 확인 (전체)
docker build --no-cache --progress=plain \
  -f platform/services/auth-service/Dockerfile \
  . 2>&1 | head -100

# 문제 1: COPY 순서가 잘못되어 캐시가 항상 무효화됨
# 잘못된 Dockerfile
FROM node:22-alpine
COPY . .                    # 모든 파일 복사 → 코드 변경마다 pnpm install 실행
RUN pnpm install

# 올바른 Dockerfile (레이어 캐시 최적화)
FROM node:22-alpine
COPY package.json pnpm-lock.yaml ./   # 의존성 파일만 먼저 복사
RUN pnpm install --frozen-lockfile    # 이 레이어는 의존성 변경 시만 재실행
COPY . .                               # 이후 소스 코드 복사
RUN pnpm run build

# CI에서 Docker BuildKit 캐시 사용
# ci.yml / deploy.yml에서 이미 설정됨:
# cache-from: type=gha
# cache-to: type=gha,mode=max
```

---

## 3. 테스트 실패 디버깅

### 3.1 Q-Gate G4 (커버리지 80%) 실패 원인별 해결

```bash
# 현재 커버리지 확인
pnpm run test -- --coverage
# 또는
pnpm exec vitest run --coverage

# coverage/coverage-summary.json 내용
{
  "total": {
    "lines": { "total": 450, "covered": 320, "pct": 71.1 },  ← 71.1% < 80%
    "functions": { "total": 80, "covered": 55, "pct": 68.75 }
  }
}
```

**원인 1: 새 파일을 작성하고 테스트를 추가하지 않은 경우**
```bash
# 어느 파일의 커버리지가 낮은지 확인
cat coverage/coverage-summary.json | \
  jq -r 'to_entries[] | select(.value.lines.pct < 80 and .key != "total") | "\(.value.lines.pct)%  \(.key)"' | \
  sort -n | head -20

# 출력 예시
# 0%   platform/services/auth-service/src/handlers/oauth.handler.ts
# 45%  platform/services/billing-service/src/lib/invoice.ts
```

```typescript
// 테스트 파일 추가 (oauth.handler.ts 기준)
// platform/services/auth-service/src/handlers/oauth.handler.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { oauthCallbackHandler } from './oauth.handler.js';

describe('oauthCallbackHandler', () => {
  it('정상 OAuth 콜백 처리', async () => {
    // ... 테스트 코드
  });

  it('잘못된 state 파라미터 거부', async () => {
    // ... 테스트 코드
  });
});
```

**원인 2: 특정 브랜치(if-else)가 커버되지 않은 경우**
```typescript
// istanbul ignore 주석으로 제외 (정당한 이유 있을 때만)
/* c8 ignore next 3 */
if (process.env.NODE_ENV === 'production') {
  // 테스트에서 재현 불가능한 케이스
}
```

**원인 3: vitest.config.ts의 include/exclude 설정 문제**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/index.ts',  // re-export 파일은 제외
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
      },
    },
  },
});
```

### 3.2 Flaky 테스트 탐지 및 처리

Flaky 테스트는 같은 코드로 어떤 때는 통과하고 어떤 때는 실패하는 불안정한 테스트입니다.

```bash
# Flaky 테스트 탐지: 같은 테스트를 여러 번 실행
for i in {1..5}; do
  pnpm run test -- --reporter=verbose 2>&1 | \
    grep -E "(PASS|FAIL)" >> test-results.txt
done
cat test-results.txt | sort | uniq -c | sort -rn
# FAIL이 1~4번 나오고 PASS가 1~4번 나오면 → Flaky 테스트
```

**Flaky 테스트 흔한 원인과 해결**:

```typescript
// 원인 1: 타임아웃 경쟁 조건
// 잘못된 코드
it('비동기 작업 완료', async () => {
  service.startLongOperation();
  await new Promise(resolve => setTimeout(resolve, 100));  // 불안정한 대기
  expect(service.isComplete()).toBe(true);
});

// 올바른 코드
it('비동기 작업 완료', async () => {
  await service.startLongOperation();  // async/await 사용
  expect(service.isComplete()).toBe(true);
});

// 원인 2: 테스트 간 상태 공유
// 잘못된 코드
let sharedDb: Database;
describe('DB 테스트', () => {
  sharedDb = new Database();  // 테스트 간 공유 → 순서 의존성
  it('테스트 1', () => { sharedDb.insert(...); });
  it('테스트 2', () => { sharedDb.query(...); });  // 테스트 1 결과에 의존
});

// 올바른 코드
describe('DB 테스트', () => {
  let db: Database;
  beforeEach(() => { db = new Database(); });    // 각 테스트마다 새 인스턴스
  afterEach(() => { db.cleanup(); });
  it('테스트 1', () => { db.insert(...); });
  it('테스트 2', () => { db.query(...); });      // 독립적
});

// 원인 3: 외부 API 의존 (Mock 미적용)
// 잘못된 코드
it('AI 응답 테스트', async () => {
  const response = await aiService.chat('안녕');  // 실제 API 호출 → 불안정
  expect(response).toBeDefined();
});

// 올바른 코드
it('AI 응답 테스트', async () => {
  vi.spyOn(aiGateway, 'send').mockResolvedValue({ text: '안녕하세요' });
  const response = await aiService.chat('안녕');
  expect(response.text).toBe('안녕하세요');
});
```

### 3.3 테스트 환경 차이 (로컬 vs CI)

```bash
# 문제: 로컬에서는 통과하는데 CI에서 실패

# 원인 진단 체크리스트
# 1. Node.js 버전 확인
node --version   # CI: 22.x
                 # 로컬: ?

# 2. 환경 변수 확인 (CI는 quality-gate.yml에서 설정)
# CI 설정 (quality-gate.yml):
# DATABASE_URL: postgresql://saas:saas_test_2026@localhost:5432/saas_platform_test
# REDIS_URL: redis://localhost:6379
# JWT_SECRET: test-jwt-secret

# 로컬 재현
export DATABASE_URL=postgresql://saas:saas_test_2026@localhost:5432/saas_platform_test
export REDIS_URL=redis://localhost:6379
export JWT_SECRET=test-jwt-secret
export NODE_ENV=test
pnpm run test

# 3. 파일 시스템 대소문자 구분
# macOS: 대소문자 무시 (기본값)
# CI Linux: 대소문자 구분 (엄격)
# 문제: import { MyService } from './myservice'  ← Linux에서 실패
#       올바른: import { MyService } from './MyService'
```

### 3.4 Vitest 테스트 격리 문제

```typescript
// 문제: 모듈 캐시가 테스트 간 공유되어 Mock이 적용되지 않음

// 해결 방법 1: vi.resetModules() 사용
beforeEach(() => {
  vi.resetModules();  // 테스트 전 모듈 캐시 초기화
});

// 해결 방법 2: vi.isolateModules() 사용
it('격리된 모듈 테스트', async () => {
  await vi.isolateModules(async () => {
    const { myModule } = await import('./myModule');
    // 이 블록 내에서만 격리된 모듈 사용
  });
});

// 해결 방법 3: vitest.config.ts에 isolate 설정
// vitest.config.ts
export default defineConfig({
  test: {
    isolate: true,       // 각 테스트 파일을 격리된 환경에서 실행
    pool: 'forks',       // 프로세스 수준 격리 (가장 강력)
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
  },
});
```

---

## 4. 보안 게이트 실패 디버깅

### 4.1 Semgrep 오탐(False Positive) 처리 방법

Semgrep은 코드 패턴을 분석하여 보안 취약점을 찾습니다. 때로는 안전한 코드를 위험하다고 잘못 판단(오탐)하기도 합니다.

```bash
# Semgrep 결과 확인
cat semgrep-results.json | jq '.results[] | {file: .path, line: .start.line, rule: .check_id, msg: .extra.message}'

# 예시 출력
{
  "file": "platform/services/auth-service/src/lib/token.ts",
  "line": 45,
  "rule": "javascript.lang.security.detect-non-literal-regexp",
  "msg": "Detected non-literal argument to RegExp constructor"
}
```

**오탐 판단 기준**:
1. 해당 코드가 실제로 사용자 입력을 직접 RegExp에 넣는가?
2. 입력 검증이 이미 적용되어 있는가?
3. 코드의 의도가 명확히 안전한가?

**오탐 억제 방법 (인라인 주석)**:

```typescript
// platform/services/auth-service/src/lib/token.ts

// 안전 확인: 이 RegExp는 환경 변수에서 로드된 패턴만 사용
// 사용자 입력 직접 전달 없음. Semgrep 오탐 억제.
// nosemgrep: javascript.lang.security.detect-non-literal-regexp
const pattern = new RegExp(process.env.ALLOWED_ORIGINS_PATTERN || '^$');
```

**프로젝트 수준 억제 (semgrep 설정 파일)**:

```yaml
# .semgrepignore (오탐 파일 경로 지정)
# 또는 infra/security/semgrep/rules/ 내 규칙 설정

# .semgrepignore
tests/fixtures/**     # 테스트 픽스처는 보안 스캔 제외
migrations/**         # DB 마이그레이션 스크립트 제외
```

> 중요: 억제 결정은 반드시 코드 리뷰를 통해 팀이 동의해야 합니다.
> 임의로 억제하면 Q-GATE G5 통과는 해도 실제 취약점이 남을 수 있습니다.

### 4.2 Trivy 취약점 억제 정책

```bash
# Trivy 스캔 결과 확인
trivy config --severity HIGH,CRITICAL helm/ 2>&1

# 또는 이미지 스캔
trivy image --severity CRITICAL,HIGH \
  localhost:8080/public-saas/auth-service:latest

# 출력 예시
# CVE-2025-12345 (HIGH)
# Library: lodash 4.17.20
# Fix: 4.17.21
```

**취약점 처리 우선순위**:

| 심각도 | 처리 방법 | 기한 |
|--------|---------|------|
| CRITICAL | 즉시 패치 | 24시간 |
| HIGH | 버전 업그레이드 | 7일 |
| MEDIUM | 다음 릴리즈에 포함 | 30일 |
| LOW | 백로그 등록 | 90일 |

**취약점 억제 정책 파일 (수정 불가능한 취약점)**:

```yaml
# trivy-ignore.yaml (또는 .trivyignore)
# 억제 사유를 반드시 기록해야 합니다

vulnerabilities:
  - id: CVE-2025-99999
    reason: "base OS 취약점 — 공급업체 패치 대기 중 (2026-07-01 예정)"
    expires: 2026-07-01T00:00:00Z

  - id: CVE-2025-88888
    reason: "해당 기능 미사용 (CVSS 벡터 분석 완료)"
    expires: 2026-04-30T00:00:00Z
```

```bash
# trivy-ignore.yaml 적용
trivy image \
  --ignorefile trivy-ignore.yaml \
  --severity CRITICAL,HIGH \
  localhost:8080/public-saas/auth-service:latest
```

### 4.3 Cosign 이미지 서명 실패

```bash
# 오류 메시지 예시
# error: signing image: getting signer: reading key: error reading key

# 진단 1: COSIGN_KEY 환경 변수 확인
echo ${COSIGN_KEY} | wc -c  # 0이면 환경 변수 미설정

# 진단 2: Cosign 키 유효성 확인
cosign verify-key --key cosign.pub

# 해결 방법 1: Gitea Secrets에 키 재등록
# Gitea → 저장소 Settings → Secrets and variables → Actions
# COSIGN_PRIVATE_KEY: PEM 형식 개인키 내용
# COSIGN_PASSWORD: 개인키 암호

# 해결 방법 2: 새 키 생성 (기존 키 분실 시)
cosign generate-key-pair
# 생성됨: cosign.key, cosign.pub
# cosign.key → Gitea Secret COSIGN_PRIVATE_KEY에 등록
# cosign.pub → 저장소에 커밋 (공개키는 공개 가능)

# 서명 검증 확인
cosign verify \
  --key cosign.pub \
  localhost:8080/public-saas/auth-service:v1.2.3
```

### 4.4 Q-Gate G5 (OWASP) 실패 처리

**실패 1: 하드코딩 시크릿 패턴 감지**

```bash
# 오류: [CRITICAL] 패턴 발견: sk-[a-zA-Z0-9]{20,}

# 진단: 어느 파일에서 감지되었는지 확인
grep -rn --include="*.ts" --include="*.js" \
  -E "sk-[a-zA-Z0-9]{20,}" \
  platform/ packages/ | grep -v node_modules | grep -v ".test."
```

```typescript
// 잘못된 코드 (CSAP D-09 위반)
const CLAUDE_API_KEY = 'sk-ant-api03-...';  // 하드코딩 시크릿

// 올바른 코드
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
if (!CLAUDE_API_KEY) {
  throw new Error('CLAUDE_API_KEY 환경 변수가 설정되지 않았습니다');
}
```

**실패 2: SQL 직접 결합 패턴 감지**

```typescript
// 잘못된 코드 (SQL 주입 취약점)
const users = await db.execute(
  `SELECT * FROM users WHERE email = '${email}'`
);

// 올바른 코드 (매개변수화 쿼리)
const users = await db.execute(
  'SELECT * FROM users WHERE email = $1',
  [email]
);

// ORM 사용 시 (Prisma — 자동으로 매개변수화)
const users = await prisma.user.findMany({
  where: { email: email },
});
```

**실패 3: G5 오탐 (테스트 코드에서 키 패턴)**

```typescript
// 테스트 코드에서 테스트용 키가 패턴에 걸리는 경우
// tests/fixtures/test-tokens.ts

// 방법 1: 파일 이름에 .test. 또는 .spec. 포함 (G5에서 자동 제외)

// 방법 2: 패턴을 실제 키와 다르게 설정
const MOCK_API_KEY = 'mock-key-for-testing-only';  // 실제 키 패턴이 아님
```

---

## 5. 배포 실패 디버깅

### 5.1 Flux HelmRelease 실패 진단

```bash
# HelmRelease 상태 확인
kubectl get helmrelease -n saas-platform
# 예시 출력:
# NAME        READY   STATUS                      AGE
# saas-prod   False   install retries exhausted   5m

# 상세 오류 확인
kubectl describe helmrelease saas-prod -n saas-platform
# Events 섹션을 확인하십시오

# Flux 컨트롤러 로그 확인
kubectl logs -n flux-system deployment/helm-controller | tail -50

# 실패한 Helm 릴리즈 복구
flux suspend helmrelease saas-prod -n saas-platform
helm uninstall saas-prod -n saas-platform
flux resume helmrelease saas-prod -n saas-platform
```

### 5.2 Flagger 카나리 진행 중단

```bash
# Flagger Canary 상태 확인
kubectl get canary -n saas-platform
# 예시 출력:
# NAME         STATUS      WEIGHT   FAILEDCHECKS
# api-gateway  Progressing 20       3

# 중단 원인 상세 확인
kubectl describe canary api-gateway -n saas-platform

# 메트릭 기반 중단 원인 확인
# Events 섹션 예시:
# "Halt api-gateway.saas-platform advancement error rate 2.50 > 1.00"
# → 에러율이 2.5%로 임계값 1% 초과

# 즉시 롤백
kubectl -n saas-platform annotate canary/api-gateway \
  flagger.app/action=rollback

# 수동 진행 (롤백 후 원인 수정 완료 시)
# 1. 원인 수정 및 새 이미지 빌드/배포
# 2. Flagger가 자동으로 새 카나리 시작
# (Canary를 수동으로 재시작할 필요 없음)
```

### 5.3 ImagePullBackOff 긴급 처리

```bash
# 증상 확인
kubectl get pods -n saas-platform
# NAME                         READY   STATUS             RESTARTS
# api-gateway-7d4c8f-xxx       0/1     ImagePullBackOff   0

# 상세 원인 확인
kubectl describe pod api-gateway-7d4c8f-xxx -n saas-platform
# Events 섹션에서 실제 오류 메시지 확인

# 원인 1: 이미지가 Harbor 레지스트리에 없음
# → deploy.yml에서 Push 단계가 성공했는지 확인
# → Harbor UI에서 이미지 존재 여부 확인

# 원인 2: Harbor 자격증명 만료
kubectl get secret harbor-registry-secret -n saas-platform
# docker-registry 타입 Secret 확인

# 자격증명 재생성
kubectl create secret docker-registry harbor-registry-secret \
  --docker-server=harbor.saas.internal \
  --docker-username="${HARBOR_USERNAME}" \
  --docker-password="${HARBOR_PASSWORD}" \
  -n saas-platform \
  --dry-run=client -o yaml | kubectl apply -f -

# 원인 3: 이미지 태그 오타 (values.yaml 확인)
helm get values saas-prod -n saas-platform | grep image
# image:
#   tag: sha-abc123  ← 실제 Harbor에 있는 태그인지 확인
```

### 5.4 Helm 차트 렌더링 오류

```bash
# 오류 메시지 예시
# Error: execution error at (saas-platform/templates/deployment.yaml:23:5):
# required value: .Values.global.imageRegistry not set

# 진단: 차트 렌더링 테스트 (실제 배포 없이)
helm template saas-prod ./helm/saas-platform/ \
  -f helm/saas-platform/values-stg.yaml \
  --set global.imageRegistry=localhost:8080 \
  --debug 2>&1 | head -50

# 수정: values 파일에 필수 값 추가
# helm/saas-platform/values-stg.yaml
global:
  imageRegistry: "harbor.saas.internal"  # 추가

# Helm 차트 문법 검사
helm lint ./helm/saas-platform/
# 예시 출력:
# ==> Linting ./helm/saas-platform/
# [INFO] Chart.yaml: icon is recommended
# 1 chart(s) linted, 0 chart(s) failed

# 특정 values 파일로 검사
helm lint ./helm/saas-platform/ -f values-prod.yaml
```

### 5.5 배포 실패 진단 의사결정 트리

```mermaid
flowchart TD
    START[배포 실패 감지\nPod가 Running이 안 됨]

    Q1{kubectl get pods 상태는?}

    subgraph PULL["이미지 풀 오류"]
        IP1[ImagePullBackOff\nErrImagePull]
        IP_FIX[Harbor 이미지 존재 확인\n→ 자격증명 확인\n→ 태그 확인]
    end

    subgraph CRASH["크래시 오류"]
        CR1[CrashLoopBackOff\nError]
        CR_CHECK{kubectl logs\n오류 내용?}
        CR_ENV[환경 변수 누락\n→ ConfigMap/Secret 확인]
        CR_CODE[애플리케이션 코드 오류\n→ 로컬 재현 후 수정]
        CR_DB[DB 연결 실패\n→ DB 상태/네트워크 확인]
    end

    subgraph PENDING["대기 오류"]
        PD1[Pending\nScheduling 불가]
        PD_NODE[Node 리소스 부족\n→ kubectl describe pod\n→ kubectl top nodes]
        PD_PVC[PVC Pending\n→ StorageClass 확인]
    end

    subgraph READY["준비 실패"]
        RD1[Running이지만\nReady=False]
        RD_PROBE[ReadinessProbe 실패\n→ /healthz 응답 확인\n→ 포트 설정 확인]
    end

    ROLLBACK[즉시 롤백\nhelm rollback 또는\nFlagger rollback]
    FIX[원인 수정 후\n재배포]

    START --> Q1
    Q1 -->|ImagePullBackOff| PULL
    Q1 -->|CrashLoopBackOff| CRASH
    Q1 -->|Pending| PENDING
    Q1 -->|Ready=False| READY

    IP1 --> IP_FIX
    CR1 --> CR_CHECK
    CR_CHECK -->|환경 변수 없음| CR_ENV
    CR_CHECK -->|앱 코드 오류| CR_CODE
    CR_CHECK -->|DB 연결 오류| CR_DB

    PD1 --> PD_NODE
    PD1 --> PD_PVC

    RD1 --> RD_PROBE

    IP_FIX --> ROLLBACK
    CR_ENV --> ROLLBACK
    CR_CODE --> ROLLBACK
    CR_DB --> ROLLBACK
    PD_NODE --> ROLLBACK
    PD_PVC --> ROLLBACK
    RD_PROBE --> ROLLBACK

    ROLLBACK --> FIX

    style PULL fill:#ffcdd2
    style CRASH fill:#ffcdd2
    style PENDING fill:#fff3e0
    style READY fill:#fff3e0
    style ROLLBACK fill:#f44336,color:#fff
    style FIX fill:#c8e6c9
```

---

## 6. DORA 게이트 차단 처리

### 6.1 Change Failure Rate 30% 초과 시 절차

DORA 게이트(`dora-gate.yml`)가 CFR 30% 초과로 배포를 차단했을 때의 절차입니다.

```bash
# 1. 현재 CFR 확인
curl -s "http://prometheus.monitoring.svc:9090/api/v1/query?query=dora_change_failure_rate" | \
  jq '.data.result[] | {team: .metric.team, cfr: (.value[1] | tonumber * 100 | round)}'

# 예시 출력
# { "team": "platform", "cfr": 34 }
```

**CFR이 높아진 원인 분석**:

```bash
# 최근 배포 실패 이력 확인 (Gitea Actions)
# Actions → workflow_runs → 실패한 배포 목록

# Prometheus에서 MTTR 확인
curl -s "http://prometheus.monitoring.svc:9090/api/v1/query?query=dora_mttr_seconds" | \
  jq '.data.result[] | {team: .metric.team, mttr_hours: (.value[1] | tonumber / 3600 | round)}'
```

**CFR 개선 방법**:

| 원인 | 개선 방법 |
|------|---------|
| 테스트 부족으로 버그 배포 | 테스트 커버리지 80% → 90% 상향 |
| 불충분한 스테이징 검증 | stg 체류 시간 24시간 이상 의무화 |
| 배포 단위가 너무 큼 | 피처 플래그로 배포 단위 분리 |
| 카나리 기준 미적용 | Flagger 카나리 배포 필수화 |
| 핫픽스가 너무 많음 | 근본 원인 분석(RCA) 프로세스 도입 |

### 6.2 배포 차단 해제 조건

DORA 게이트 차단을 해제하려면 다음 조건을 충족해야 합니다.

```bash
# 조건 1: CFR이 15% 미만으로 개선
# (최근 30일 배포 중 실패율을 낮춰야 함)
# 실패한 배포를 성공 배포로 역전시켜야 함

# 조건 2: 감사 로그에 개선 기록
echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","action":"DORA_IMPROVEMENT","detail":"CFR 34%→12% 개선 — 테스트 커버리지 강화 및 카나리 배포 도입","actor":"팀리드명","csap_ref":"D-12"}' \
  >> .claude/audit.jsonl

# 조건 3: 팀 리드 승인
# 팀 리드가 원인 분석 및 재발 방지 대책을 확인 후 승인

# CFR 개선 확인 후 재배포 시도
# dora-gate.yml이 자동으로 재평가
```

### 6.3 팀 리드 에스컬레이션 방법

```
에스컬레이션 매트릭스:

CFR 15~30% (경고):
  → 팀 내 원인 분석 및 개선 계획 수립
  → 주간 팀 회의에서 공유

CFR 30% 초과 (차단):
  → 즉시 팀 리드에게 보고
  → 원인 분석 문서 작성 (RCA)
  → 재발 방지 대책 수립 후 팀 리드 승인

CFR이 지속적으로 높은 경우 (2주 이상):
  → 개발 팀장 에스컬레이션
  → DORA 성숙도 개선 계획 수립
  → Q-Gate 임계값 재검토

에스컬레이션 기록 (감사 로그):
echo '{"action":"DORA_ESCALATION","to":"팀리드명","reason":"CFR 34% 2주 지속","timestamp":"..."}' \
  >> .claude/audit.jsonl
```

---

## 7. 실전 CI/CD 디버깅 시나리오

### 시나리오 1: PR 작성 후 Q-Gate G3 실패

**상황**: 새 API 핸들러를 작성하고 PR을 올렸는데 G3 코드 품질 검사에서 실패했습니다.

**단계별 해결**:

1. Gitea Actions에서 G3 Job의 실패 로그를 확인합니다.

```
[G3] 코드 품질 실패
> pnpm run typecheck
> platform/services/menu-service/src/handlers/menu.handler.ts(78,15):
  error TS2339: Property 'tenantId' does not exist on type 'FastifyRequest'.
```

2. 오류 파일을 로컬에서 열어 해당 줄을 확인합니다.

```typescript
// platform/services/menu-service/src/handlers/menu.handler.ts:78
// 잘못된 코드
const tenantId = request.tenantId;  // FastifyRequest에 tenantId 없음
```

3. Fastify 타입 확장을 확인하거나 헤더에서 읽도록 수정합니다.

```typescript
// 올바른 코드
const tenantId = request.headers['x-user-tenant-id'] as string;
if (!tenantId) {
  return reply.status(400).send({ error: 'x-user-tenant-id 헤더 필수' });
}
```

4. 로컬에서 타입 체크를 통과하는지 확인합니다.

```bash
pnpm run typecheck
# TypeScript 오류 없음이 출력되면 준비 완료
```

5. 수정 사항을 push하면 CI가 자동으로 재실행됩니다.

---

### 시나리오 2: stg 배포 후 Pod가 Ready 되지 않음

**상황**: stg 브랜치에 머지하고 배포가 완료되었는데, `kubectl get pods`에서 `0/1 Running` 상태가 지속됩니다.

**단계별 해결**:

```bash
# 1. Pod 상태 상세 확인
kubectl get pods -n saas-stg -l app=subscription-service
# NAME                                 READY   STATUS    RESTARTS
# subscription-service-7df9c4-abcde    0/1     Running   0

# 2. Pod 이벤트 확인
kubectl describe pod subscription-service-7df9c4-abcde -n saas-stg | \
  grep -A 20 "Events:"
# Readiness probe failed: Get "http://10.42.1.5:3006/healthz": dial tcp: connect: connection refused

# 3. 실제 이유 확인: 앱 로그
kubectl logs subscription-service-7df9c4-abcde -n saas-stg
# PrismaClientInitializationError: Can't reach database server at 'stg-db.saas-stg.svc:5432'

# → DB 연결 실패가 원인

# 4. DB 서비스 상태 확인
kubectl get svc -n saas-stg | grep db
kubectl get pods -n saas-stg | grep db

# 5. 환경 변수 확인
kubectl exec -n saas-stg subscription-service-7df9c4-abcde -- \
  env | grep DATABASE_URL
# DATABASE_URL=postgresql://saas:****@stg-db.saas-stg.svc:5432/saas_stg

# 6. DB 연결 테스트
kubectl run -it --rm debug --image=postgres:16-alpine --restart=Never \
  -n saas-stg -- psql postgresql://saas:password@stg-db.saas-stg.svc:5432/saas_stg -c '\l'
# 연결 성공이면 비밀번호 확인, 실패이면 서비스/네트워크 문제

# 7. 해결 후 Pod 재시작
kubectl rollout restart deployment/subscription-service -n saas-stg
```

---

### 시나리오 3: 새벽 자동 배포 실패 후 아침에 발견

**상황**: 새벽 2시에 자동 스케줄 배포가 실행되었는데, 아침에 출근하니 배포가 실패해 있고 프로덕션은 이전 버전으로 운영 중입니다.

**대응 절차**:

```bash
# 1. 현재 상태 파악 (5분 이내)
kubectl get helmrelease saas-prod -n saas-platform
kubectl get pods -n saas-platform
# → 현재 실행 중인 버전과 상태 파악

# 2. 실패 이유 확인 (Gitea Actions 로그)
# Actions → 실패한 Run → 각 Job 로그 확인

# 3. Helm 이력 확인
helm history saas-prod -n saas-platform
# REVISION  UPDATED      STATUS     CHART              DESCRIPTION
# 5         새벽 02:03   failed     saas-platform-1.5  upgrade failed (버전 5)
# 4         어제 15:00   deployed   saas-platform-1.4  deployed (버전 4 — 현재 운영 중)

# 4. 이전 버전(4)이 정상 운영 중인지 확인
kubectl get pods -n saas-platform | grep -v Running
# 아무것도 없으면 → 이전 버전이 정상 운영 중

# 5. Helm이 자동으로 롤백했는지 확인
helm status saas-prod -n saas-platform | grep STATUS
# STATUS: deployed (이전 버전으로 자동 롤백 완료)

# 6. 실패 원인 분석 및 수정
# Gitea Actions 로그에서 실제 오류 메시지 확인
# → 환경 변수 누락, 이미지 풀 실패, 리소스 부족 등

# 7. 수정 후 재배포
# 원인 수정 → 커밋 → stg 검증 → 팀 리드 승인 → prod 재배포

# 8. 감사 로그에 인시던트 기록
echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","action":"DEPLOY_FAILURE_POSTMORTEM","version":"v1.5","failure_reason":"환경 변수 누락","impact":"0분 (자동 롤백)","csap_ref":"D-06"}' \
  >> .claude/audit.jsonl
```

---

### 시나리오 4: Semgrep이 새 규칙으로 이전 코드를 블록

**상황**: 코드 변경 없이 Semgrep 규칙이 업데이트되어, 이전에 통과하던 코드가 새 규칙에서 실패합니다.

**대응 절차**:

```bash
# 1. 실패한 규칙 확인
cat semgrep-results.json | \
  jq '.results[] | {rule: .check_id, file: .path, line: .start.line, msg: .extra.message}'

# 예시 출력:
# {
#   "rule": "javascript.jwt.hardcoded-jwt-secret",
#   "file": "tests/fixtures/auth-test-helpers.ts",
#   "line": 15,
#   "msg": "Hardcoded JWT secret detected"
# }
```

```typescript
// tests/fixtures/auth-test-helpers.ts:15
const TEST_JWT_SECRET = 'test-jwt-secret-for-unit-tests-only';
// ↑ 테스트 코드의 명시적 테스트용 값 → 오탐
```

**오탐 여부 판단**:
- 이 값이 테스트 코드인가? → 오탐
- 이 값이 프로덕션에서 실제로 사용되는가? → 진짜 취약점

**오탐인 경우 처리**:

```typescript
// 방법 1: nosemgrep 인라인 주석 추가
// nosemgrep: javascript.jwt.hardcoded-jwt-secret
const TEST_JWT_SECRET = 'test-jwt-secret-for-unit-tests-only';

// 방법 2: .semgrepignore 파일에 테스트 경로 추가
# .semgrepignore
tests/fixtures/**
**/*.test.ts
**/*.spec.ts
```

**진짜 취약점인 경우 처리**:

```typescript
// 즉시 환경 변수로 교체
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET 환경 변수가 설정되지 않았습니다 (CSAP D-09)');
}
```

**팀 공유**: 새 Semgrep 규칙으로 발견된 레거시 코드가 여러 파일에 있을 경우, 별도 이슈를 등록하고 체계적으로 정리합니다.

```bash
# 같은 패턴이 몇 개나 있는지 확인
cat semgrep-results.json | \
  jq '[.results[] | select(.check_id == "javascript.jwt.hardcoded-jwt-secret")] | length'

# 5개 이상이면 → GitHub/Gitea 이슈 등록 후 스프린트 단위로 처리
```

---

## 8. CI/CD 로그 보존 및 CSAP

### 8.1 Gitea Actions 로그 보존 기간

```yaml
# deploy.yml에서 아티팩트 보존 기간 설정
- name: Upload audit log
  uses: actions/upload-artifact@v4
  with:
    name: deploy-audit
    path: deploy-audit.jsonl
    retention-days: 365  # CSAP D-06: 최소 1년 보존

# Gitea Actions 로그 자체 보존:
# Gitea 설정 → Administration → Actions → Log 보존 기간
# 권장: 90일 이상
# CSAP D-06 요건: 최소 1년 (아티팩트로 별도 보관)
```

### 8.2 감사 목적의 배포 이력 보존

감리 시 제출해야 하는 배포 이력은 `.claude/audit.jsonl`에 자동으로 기록됩니다.

```bash
# 특정 기간의 배포 이력 조회 (감리 대응)
jq -r 'select(.action == "DEPLOY" or .action == "HOTFIX_DEPLOY") |
  [.timestamp, .action, .actor, .ref, .status] | @csv' \
  .claude/audit.jsonl | \
  awk -F, '$1 >= "\"2026-01-01\"" && $1 <= "\"2026-04-12\""'

# 예시 출력:
# "2026-04-10T14:23:01Z","DEPLOY","developer1","refs/heads/stg","success"
# "2026-04-11T09:15:44Z","HOTFIX_DEPLOY","developer2","hotfix/auth-fix","success"
# "2026-04-12T02:03:11Z","DEPLOY","github-actions","refs/tags/v1.2.3","success"
```

### 8.3 CSAP D-06 CI/CD 변경 기록 요건

| CSAP 요건 | 구현 위치 | 기록 내용 |
|----------|---------|---------|
| D-06-03: 변경 사항 기록 | deploy.yml Audit log step | 배포 시간, 배포자, SHA, 상태 |
| D-06-04: 침해사고 관련 변경 | dora-gate.yml | DEPLOY_BLOCKED, CFR 값, 사유 |
| D-06-05: 비정상 활동 감지 | devsecops.yml | 시크릿 감지, SQL 주입 패턴 |
| D-12-07: 개발 환경 변경 통제 | prod-gate.yaml | PROD_GATE_CHECK 결과 |
| D-13-01: 변경 관리 | hotfix-pipeline.yaml | HOTFIX_DEPLOY, 승인자 |

**감리 제출 자료 패키지 생성**:

```bash
#!/bin/bash
# scripts/generate-audit-evidence.sh
# CSAP 감리 대응 증거 자료 패키지 생성

AUDIT_PERIOD_START="${1:-2026-01-01}"
AUDIT_PERIOD_END="${2:-2026-04-12}"
OUTPUT_DIR="audit-evidence-$(date +%Y%m%d)"

mkdir -p "$OUTPUT_DIR"

# 1. 배포 이력 추출
jq -r "select(.timestamp >= \"${AUDIT_PERIOD_START}\" and .timestamp <= \"${AUDIT_PERIOD_END}\") |
  select(.action == \"DEPLOY\" or .action == \"HOTFIX_DEPLOY\" or .action == \"EMERGENCY_CHANGE\")" \
  .claude/audit.jsonl > "$OUTPUT_DIR/deployment-history.jsonl"

# 2. DORA 게이트 기록 추출
jq -r "select(.action == \"DEPLOY_BLOCKED\" or .action == \"DEPLOY_WARNING\" or .action == \"DEPLOY_APPROVED\")" \
  .claude/audit.jsonl > "$OUTPUT_DIR/dora-gate-history.jsonl"

# 3. 보안 관련 기록 추출
jq -r "select(.action | test(\"SECURITY|BLOCKED|VIOLATION\"))" \
  .claude/audit.jsonl > "$OUTPUT_DIR/security-events.jsonl"

# 4. 요약 리포트
echo "=== 감리 증거 자료 패키지 ===" > "$OUTPUT_DIR/summary.txt"
echo "기간: ${AUDIT_PERIOD_START} ~ ${AUDIT_PERIOD_END}" >> "$OUTPUT_DIR/summary.txt"
echo "총 배포 수: $(wc -l < $OUTPUT_DIR/deployment-history.jsonl)" >> "$OUTPUT_DIR/summary.txt"
echo "DORA 차단 수: $(jq -r 'select(.action == "DEPLOY_BLOCKED")' $OUTPUT_DIR/dora-gate-history.jsonl | wc -l)" >> "$OUTPUT_DIR/summary.txt"

echo "감리 증거 자료 생성 완료: $OUTPUT_DIR/"
```

---

## 9. 학습 체크리스트

이 문서를 완료한 후 다음 항목을 직접 확인하십시오.

- [ ] Gitea Actions에서 실패한 Job의 로그를 열어 오류 메시지를 찾을 수 있다
- [ ] TypeScript 오류 코드(TS2345, TS2307 등)를 보고 어떤 문제인지 설명할 수 있다
- [ ] `pnpm install --frozen-lockfile` 오류가 왜 발생하는지, 어떻게 해결하는지 안다
- [ ] Vitest 커버리지 리포트에서 어느 파일의 커버리지가 낮은지 찾을 수 있다
- [ ] Semgrep 오탐과 실제 취약점을 구분하는 기준을 설명할 수 있다
- [ ] `kubectl describe pod <이름>` 결과에서 ImagePullBackOff 원인을 파악할 수 있다
- [ ] DORA 게이트가 배포를 차단했을 때 해제 조건이 무엇인지 안다
- [ ] 시나리오 3(새벽 자동 배포 실패)을 혼자서 대응할 수 있다
- [ ] `.claude/audit.jsonl`에서 특정 기간의 배포 이력을 jq로 추출할 수 있다

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|-------|
| 1.0.0 | 2026-04-12 | 최초 작성 — CI/CD 디버깅 완전 가이드 (4개 실전 시나리오 포함) | 온보딩팀 |
