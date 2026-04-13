# 개발자 경험(DX) 완전 가이드 — VS Code, Claude Code 워크플로우, 로컬 개발 환경 최적화

---

| 항목 | 내용 |
|------|------|
| 문서 ID | GUIDE-DEV-43 |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-13 |
| 목적 | 공공기관 SaaS 개발자가 하루라도 빨리 생산적인 개발 환경을 구축하고, Claude Code + PDCA 워크플로우를 마스터하도록 지원 |
| 선행 학습 | GUIDE-DEV-01 (로컬 환경 초기 설정), GUIDE-DEV-07 (모노레포 탐색) |
| 관련 FR ID | CC-REQ-1~CC-REQ-5 |
| CSAP 연계 | D-06 침해사고 관리 (감사 로그), D-12 시스템 개발 보안 |

---

## 목차

1. [개발자 경험 최적화 여정](#1-개발자-경험-최적화-여정)
2. [VS Code 필수 익스텐션 및 설정](#2-vs-code-설정)
3. [pnpm Workspace 개발 워크플로우](#3-pnpm-workspace-워크플로우)
4. [Claude Code 완전 활용 가이드](#4-claude-code-완전-활용-가이드)
5. [개발 환경 변수 관리](#5-환경-변수-관리)
6. [로컬 k3s 개발 환경](#6-로컬-k3s-개발-환경)
7. [커밋 전 자동 검사 체인](#7-커밋-전-자동-검사)
8. [Turbo 캐시 최적화](#8-turbo-캐시-최적화)
9. [개발자 생산성 지표 — DORA Four Keys](#9-dora-four-keys)
10. [팀 개발 워크플로우](#10-팀-개발-워크플로우)
11. [IDE 통합 도구 접근법](#11-ide-통합-도구)
12. [변경 이력](#변경-이력)

---

## 1. 개발자 경험 최적화 여정

### 1.1 왜 DX(Developer Experience)가 중요한가

공공기관 SaaS 프레임워크는 복잡한 마이크로서비스 아키텍처, CSAP 준수 요건, 멀티테넌트 데이터 격리 등 고려해야 할 요소가 많습니다. DX가 좋지 않으면 개발자가 실수를 하거나 보안 검사를 건너뛰는 일이 생깁니다. 반대로 DX가 좋으면 개발자가 올바른 일을 쉽게 할 수 있습니다.

이 프로젝트의 DX 목표:
- **신규 개발자**: 30분 이내에 로컬 환경 구동
- **기능 개발**: Plan → Design → 구현 → 테스트 → 배포 자동화
- **코드 품질**: 커밋 전 자동 검사로 품질 문제 조기 발견
- **AI 활용**: Claude Code가 CSAP 요건을 자동으로 고려

### 1.2 DX 최적화 여정 플로우차트

```mermaid
flowchart TD
    Start["신규 개발자 합류"] --> A

    subgraph Day1["첫째 날 — 환경 구축"]
        A["VS Code + 익스텐션 설치"] --> B["Node.js 22 + pnpm 설치"]
        B --> C["git clone + pnpm install"]
        C --> D["pnpm --filter @public-saas/portal dev\n포털 로컬 구동 확인"]
        D --> E["Claude Code 설치\n$ npm install -g @anthropic-ai/claude-code"]
    end

    subgraph Day2["둘째 날 — 도구 마스터"]
        F["pnpm workspace 명령어 연습\npnpm --filter, turbo dev"] --> G
        G["Claude Code 기본 사용\n/pdca, /pm 명령어"] --> H
        H["첫 번째 기능 브랜치 생성\ngit checkout -b feat/내이름-hello"]
    end

    subgraph Week1["첫째 주 — 패턴 습득"]
        I["PDCA 사이클 1회 완전 수행\nPlan → Design → Impl → Review"] --> J
        J["실제 FR 추적 주석 작성\n// Plan SC: FR-UP.X"] --> K
        K["CSAP 보안 패턴 적용\nRBAC, 감사 로그, 입력 검증"]
    end

    E --> F
    H --> I
    K --> L["생산적인 개발자 완성"]

    style Start fill:#d4edda
    style L fill:#d4edda
    style Day1 fill:#f0f4e8
    style Day2 fill:#e8f4f8
    style Week1 fill:#fff3cd
```

---

## 2. VS Code 설정

### 2.1 필수 익스텐션 목록

다음 익스텐션은 이 프로젝트 작업에 필수입니다. VS Code 명령 팔레트(`Ctrl+P`)에서 `ext install [식별자]`로 설치합니다.

| 익스텐션 | 식별자 | 용도 |
|---------|--------|------|
| ESLint | `dbaeumer.vscode-eslint` | TypeScript 린트 실시간 표시 |
| Prettier | `esbenp.prettier-vscode` | 코드 자동 정렬 |
| Prisma | `Prisma.prisma` | DB 스키마 자동완성 + 포매팅 |
| GitLens | `eamodio.gitlens` | git 히스토리 인라인 표시 |
| REST Client | `humao.rest-client` | `.http` 파일로 API 테스트 |
| Docker | `ms-azuretools.vscode-docker` | Dockerfile 편집 + 컨테이너 관리 |
| Kubernetes | `ms-kubernetes-tools.vscode-kubernetes-tools` | k8s 리소스 탐색 |
| Thunder Client | `rangav.vscode-thunder-client` | GUI API 클라이언트 |
| Error Lens | `usernamehw.errorlens` | 오류를 줄에 인라인 표시 |
| Tailwind CSS IntelliSense | `bradlc.vscode-tailwindcss` | Tailwind 클래스 자동완성 |
| YAML | `redhat.vscode-yaml` | k8s YAML 스키마 검증 |
| Todo Tree | `Gruntfuggly.todo-tree` | TODO/FIXME 주석 집계 |

### 2.2 프로젝트 공유 설정 (`.vscode/settings.json`)

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "editor.rulers": [120],
  "editor.linkedEditing": true,

  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[prisma]": {
    "editor.defaultFormatter": "Prisma.prisma"
  },
  "[yaml]": {
    "editor.defaultFormatter": "redhat.vscode-yaml"
  },

  "typescript.preferences.importModuleSpecifier": "shortest",
  "typescript.tsdk": "node_modules/typescript/lib",

  "eslint.workingDirectories": [
    { "pattern": "packages/*/" },
    { "pattern": "platform/apps/*/" },
    { "pattern": "platform/packages/*/" },
    { "pattern": "platform/services/*/" }
  ],
  "eslint.validate": ["typescript", "typescriptreact"],

  "files.exclude": {
    "**/node_modules": true,
    "**/.next": true,
    "**/dist": true,
    "**/.turbo": true
  },

  "search.exclude": {
    "**/node_modules": true,
    "**/.next": true,
    "**/pnpm-lock.yaml": true
  },

  "tailwindCSS.experimental.classRegex": [
    ["clsx\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ],

  "yaml.schemas": {
    "kubernetes": "*.yaml"
  }
}
```

### 2.3 디버그 설정 (`.vscode/launch.json`)

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Portal (Next.js)",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/platform/apps/portal/node_modules/.bin/next",
      "args": ["dev", "--port", "4000"],
      "cwd": "${workspaceFolder}/platform/apps/portal",
      "env": {
        "NODE_ENV": "development"
      },
      "sourceMaps": true,
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Auth Service (Fastify)",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "tsx",
      "args": ["src/app.ts"],
      "cwd": "${workspaceFolder}/platform/services/auth-service",
      "env": {
        "NODE_ENV": "development",
        "PORT": "3001"
      },
      "sourceMaps": true
    },
    {
      "name": "Jest — 현재 파일",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": [
        "${fileBasenameNoExtension}",
        "--no-coverage",
        "--testEnvironment=node"
      ],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### 2.4 권장 스니펫 (`.vscode/snippets.code-snippets`)

자주 쓰는 CSAP 패턴을 스니펫으로 등록하면 빠르게 작성할 수 있습니다.

```json
{
  "CSAP API Route": {
    "prefix": "csap-route",
    "body": [
      "// Design Ref: ${1:§섹션} — ${2:결정 근거}",
      "// Plan SC: ${3:FR-XXX.X}",
      "// CSAP: ${4:D-08 접근 통제}",
      "",
      "import { NextResponse } from 'next/server';",
      "import { getAuthContext${5:, isSuperAdmin} } from '@/lib/auth-guard';",
      "",
      "export const dynamic = 'force-dynamic';",
      "",
      "export async function GET() {",
      "  const auth = await getAuthContext();",
      "  if (!auth) {",
      "    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });",
      "  }",
      "",
      "  try {",
      "    $0",
      "  } catch (error) {",
      "    process.stderr.write(`[API] 오류: ${String(error)}\\n`);",
      "    return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 });",
      "  }",
      "}"
    ],
    "description": "CSAP D-08/D-12 준수 API Route Handler 템플릿"
  },
  "CSAP Audit Log": {
    "prefix": "csap-audit",
    "body": [
      "// CSAP D-06: 감사 로그",
      "await sendAuditLog({",
      "  action: '${1:ACTION_NAME}',",
      "  target: ${2:targetId},",
      "  targetType: '${3:RESOURCE_TYPE}',",
      "  metadata: { ${4} },",
      "});"
    ],
    "description": "CSAP D-06 감사 로그 기록 스니펫"
  },
  "Design Ref Comment": {
    "prefix": "design-ref",
    "body": [
      "// Design Ref: ${1:DESIGN-DOC} §${2:섹션} — ${3:결정 근거}",
      "// Plan SC: ${4:FR-XX.X}"
    ],
    "description": "감리 추적성 주석 (Design Ref + Plan SC)"
  }
}
```

---

## 3. pnpm Workspace 워크플로우

### 3.1 모노레포 구조 이해

이 프로젝트는 pnpm workspace 모노레포입니다. 하나의 저장소에 여러 패키지와 서비스가 있습니다.

```
ai-saas/ (루트)
├── packages/                      # 독립 패키지 (npm 배포 가능)
│   ├── dora-exporter/             # DORA 메트릭 수집기
│   ├── feature-flag-sdk/          # 기능 플래그 SDK
│   ├── ml-pipeline/               # ML 파이프라인
│   └── slo-escalation/            # SLO 에스컬레이션
├── platform/
│   ├── apps/
│   │   └── portal/                # Next.js 포털 앱
│   ├── packages/
│   │   ├── mesh-ready/            # 서비스 메시 통합 패키지
│   │   └── ui/                    # 공통 UI 컴포넌트
│   └── services/
│       ├── auth-service/          # Fastify 마이크로서비스
│       ├── api-gateway/
│       ├── ai-service/
│       └── ...기타 서비스들
└── pnpm-workspace.yaml
```

### 3.2 핵심 pnpm 명령어

```bash
# 특정 패키지만 개발 서버 실행
pnpm --filter @public-saas/portal dev
pnpm --filter @public-saas/auth-service dev

# 패키지 이름 확인 방법 (각 package.json의 "name" 필드)
cat platform/apps/portal/package.json | grep '"name"'
# "@public-saas/portal"

# 여러 서비스 동시 실행 (turbo 없이)
pnpm --filter "@public-saas/auth-service" dev &
pnpm --filter "@public-saas/portal" dev &

# 특정 패키지에 의존성 추가
pnpm --filter @public-saas/portal add lodash
pnpm --filter @public-saas/auth-service add -D vitest  # 개발 의존성

# 모든 패키지에 명령 실행
pnpm -r run build        # 전체 빌드
pnpm -r run test         # 전체 테스트
pnpm -r run lint         # 전체 린트

# 특정 디렉토리 패턴으로 필터
pnpm --filter "./platform/services/*" build  # 모든 서비스 빌드
```

### 3.3 개발 시작 전 체크리스트

```bash
# 1. 의존성 설치 (처음 또는 pnpm-lock.yaml 변경 후)
pnpm install

# 2. 공유 패키지 빌드 (서비스들이 참조하는 패키지)
pnpm --filter @public-saas/mesh-ready build
pnpm --filter @public-saas/ui build

# 3. 데이터베이스 마이그레이션 (스키마 변경 후)
pnpm --filter @public-saas/workspace exec prisma migrate dev

# 4. 개발 서버 시작
pnpm --filter @public-saas/portal dev

# 5. 변경 사항 확인
git status
git diff
```

### 3.4 패키지 간 의존성 관리

```bash
# 모노레포 내 다른 패키지를 의존성으로 추가
# workspace:* — 항상 로컬 버전 참조 (npm 배포 버전 아님)
pnpm --filter @public-saas/auth-service add @public-saas/mesh-ready@workspace:*

# 결과 (package.json):
# "dependencies": {
#   "@public-saas/mesh-ready": "workspace:*"
# }
```

### 3.5 Turbo로 병렬 빌드 (선택사항)

Turbo를 사용하면 의존성 그래프를 분석하여 병렬로 빌드합니다.

```bash
# turbo가 설치되어 있다면
pnpm dlx turbo dev --filter @public-saas/portal...
# "..." 은 "이 패키지와 의존하는 모든 패키지" 의미

# 빌드 캐시 확인
pnpm dlx turbo build --dry-run  # 실제 실행 없이 계획만 출력
```

---

## 4. Claude Code 완전 활용 가이드

### 4.1 Claude Code란 무엇인가

Claude Code는 Anthropic의 AI 코딩 어시스턴트로, 이 프로젝트의 개발 워크플로우에 깊이 통합되어 있습니다. 단순한 코드 생성 도구가 아니라, CSAP 요건, 감사 로그, RBAC 패턴을 자동으로 고려하는 전문 에이전트 시스템입니다.

```bash
# Claude Code 설치
npm install -g @anthropic-ai/claude-code

# 프로젝트에서 시작
cd /data/ai-saas
claude

# 현재 상태에서 CLAUDE.md를 자동으로 읽고 컨텍스트 파악
```

### 4.2 이 프로젝트의 Claude Code 설정 분석

`.claude/settings.json`에는 이 프로젝트에 특화된 설정이 있습니다.

```json
// .claude/settings.json (실제 파일 구조)
{
  "model": "claude-sonnet-4-6",
  "effortLevel": "high",

  "env": {
    "ECC_HOOK_PROFILE": "strict",        // 모든 훅 활성화
    "ECC_GOVERNANCE_CAPTURE": "1",        // 민감 작업 전수 로깅
    "ENABLE_VERBOSE_LOGGING": "1"
  },

  "hooks": {
    "PreToolUse": [
      // 1. git --no-verify 차단 (훅 우회 금지)
      // 2. 파괴적 명령어 차단 (rm -rf, DROP TABLE, force push)
      // 3. .env 파일 수정 차단 (시크릿 보호)
    ],
    "PostToolUse": [
      // 1. 모든 Bash 명령 감사 로그 기록 (.claude/audit.jsonl)
      // 2. archive 디렉토리에 report.md 저장 시 자동 git 커밋
    ]
  }
}
```

**이 설정이 의미하는 것:**
- Claude Code가 `git commit --no-verify`를 요청하면 자동 차단
- Claude Code가 실행한 모든 Bash 명령이 `.claude/audit.jsonl`에 기록됨 (CSAP D-06)
- `.env` 파일 수정 시도 자동 차단 (CSAP D-09)

### 4.3 PDCA 워크플로우 — 5개 에이전트 Cascade

이 프로젝트는 5개의 전문 Claude Code 에이전트가 순서대로 작업합니다.

```
[기능 개발 요청]
    ↓
1. Implementer (구현)
   - Plan + Design 문서 읽기
   - CSAP 요건 고려한 코드 작성
   - 감사 로그, RBAC 패턴 적용
    ↓
2. Reviewer (품질 검사)
   - 코드 수정 없이 리포트만 생성
   - OWASP Top10 검사
   - 하드코딩 시크릿, SQL Injection 탐지
    ↓
3. Auditor (규제 검증)
   - CSAP 79개 항목 체크
   - N2SF 6개 보안 영역 검증
   - 감사 추적성 확인
    ↓
4. Tester (테스트 작성/실행)
   - 커버리지 80%+ 달성
   - 보안 시나리오 테스트
    ↓
5. Refactorer (Dead code 정리)
   - 미사용 함수/변수 제거
   - 코드 크기 최적화
```

### 4.4 Claude Code 실제 사용 패턴

**패턴 1: 새 기능 구현 요청**

```bash
# 터미널에서 claude 실행
cd /data/ai-saas
claude

# Claude에게 요청하는 방법
# 올바른 방법:
"docs/01-plan/features/FR-TENANT-001.plan.md 파일을 읽고
 테넌트 생성 Server Action을 구현해주세요.
 CSAP D-08 RBAC과 D-06 감사 로그를 포함해야 합니다."

# 잘못된 방법 (문서 없이 바로 구현 요청):
"테넌트 생성 API 만들어줘"
# → CLAUDE.md: "구현 착수 전 Plan + Design 문서 완비 필수"
```

**패턴 2: 코드 리뷰 요청**

```bash
# 현재 브랜치의 변경사항 리뷰
"git diff main 결과를 CSAP D-08, D-12 관점에서 리뷰해주세요.
 하드코딩된 시크릿이나 인증 우회 패턴이 있는지 확인해주세요."
```

**패턴 3: 트러블슈팅**

```bash
# 특정 오류 분석
"platform/services/auth-service/src/ 코드를 읽고
 다음 오류를 분석해주세요:
 'Error: JWT verification failed at auth-service:3001'
 가능한 원인과 해결책을 제안해주세요."
```

### 4.5 CLAUDE.md 역할과 활용

CLAUDE.md는 Claude Code가 프로젝트를 시작할 때 항상 읽는 "지시서"입니다.

```markdown
# CLAUDE.md의 핵심 역할

1. 절대 제약 정의
   - 구현 전 문서 완비 필수
   - .env 파일 커밋 금지
   - git --no-verify 금지

2. 에이전트 분업 정의
   - 5개 에이전트 역할 명시
   - Cascade 순서 (구현→리뷰→감사→테스트→리팩토링)

3. 품질 기준 (Q-GATE)
   - G1: FR ID 전수 추적
   - G3: AgentShield 102 규칙
   - G4: 커버리지 80%+
   - G6: CSAP 100%
   - G7: audit.jsonl 완비
```

### 4.6 프로젝트별 규칙 파일 활용

`.claude/rules/` 디렉토리의 파일들은 더 상세한 규칙을 담고 있습니다.

```bash
ls /data/ai-saas/.claude/rules/
# csap-compliance.md   — CSAP/N2SF 코드 패턴 (금지사항 + 올바른 패턴)
# deadcode-policy.md   — Dead code 탐지 및 처리 기준
# harness-constraints.md — 코딩 스타일, Git 워크플로우
```

**csap-compliance.md를 Claude에게 참조시키는 방법:**

```bash
# Claude에게 직접 지시
"csap-compliance.md의 D-12 패턴을 참고하여
 createUserAction Server Action을 구현해주세요."

# Claude는 이미 CLAUDE.md를 통해 이 파일의 존재를 알고 있음
# 필요시 파일을 직접 읽어 패턴 적용
```

### 4.7 감사 로그 확인 — Claude Code 활동 추적

CSAP D-06 요건에 따라 Claude Code의 모든 활동이 기록됩니다.

```bash
# 오늘의 Claude Code 활동 확인
cat /data/ai-saas/.claude/audit.jsonl | tail -20 | python3 -c "
import sys, json
for line in sys.stdin:
    try:
        entry = json.loads(line.strip())
        print(f'{entry[\"timestamp\"]} — {entry[\"tool\"]}')
    except:
        pass
"

# 특정 날짜 감사 로그 (bkit 기반 상세 로그)
cat /data/ai-saas/.bkit/audit/2026-04-13.jsonl | head -20
```

---

## 5. 환경 변수 관리

### 5.1 환경 변수 전략 — 계층적 접근

이 프로젝트는 다음 원칙으로 환경 변수를 관리합니다.

```
환경 변수 파일 계층 (높을수록 우선순위 높음):
1. .env.local         → 로컬 개발자 개인 설정 (git 무시)
2. .env.development   → 개발 환경 기본값 (팀 공유, 민감정보 제외)
3. .env               → 공통 기본값 (git 추적, 비밀정보 없음)

절대 금지:
- 실제 DB 비밀번호, API 키를 .env.development에 저장
- .env.local을 git에 커밋
- 코드에 하드코딩 (CSAP D-09 위반)
```

### 5.2 .env.example — 팀 공유용 템플릿

```bash
# /data/ai-saas/platform/apps/portal/.env.example
# (실제 비밀 값 없이 필요한 키 목록만 문서화)

# ============================================================
# 데이터베이스 (서버 전용 — 클라이언트 노출 금지)
# ============================================================
DATABASE_URL="postgresql://user:password@localhost:5432/saas_dev"

# ============================================================
# API 게이트웨이 URL (클라이언트에서도 사용)
# ============================================================
NEXT_PUBLIC_API_GATEWAY_URL="http://localhost:3000"
NEXT_PUBLIC_AUDIT_SERVICE_URL="http://localhost:3012"

# ============================================================
# 인증 (서버 전용)
# ============================================================
JWT_SECRET="your-secret-key-minimum-32-chars"
JWT_EXPIRES_IN="15m"

# ============================================================
# 암호화 (CSAP D-09: AES-256)
# ============================================================
ENCRYPTION_KEY="your-32-byte-encryption-key-here"

# ============================================================
# AI Gateway (N2SF: O등급 데이터만, PII 마스킹 후)
# ============================================================
AI_GATEWAY_URL="http://localhost:8080/ai"
AI_GATEWAY_API_KEY="your-ai-gateway-key"
```

### 5.3 환경 변수 검증 — 시작 시 필수 값 확인

```typescript
// lib/env-validation.ts
// 서비스 시작 시 필수 환경 변수가 있는지 검증
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET는 최소 32자 이상이어야 합니다'),
  NODE_ENV: z.enum(['development', 'production', 'test']),
  ENCRYPTION_KEY: z.string().length(32, 'AES-256 키는 정확히 32바이트입니다'),
});

export function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
    console.error('환경 변수 검증 실패:');
    missing.forEach(m => console.error(`  - ${m}`));
    process.exit(1); // 잘못된 환경으로 서비스 시작 방지
  }
  return result.data;
}

// app.ts (서비스 진입점)
import { validateEnv } from './lib/env-validation';
const env = validateEnv(); // 시작 즉시 검증
```

### 5.4 NEXT_PUBLIC_ 접두사 주의사항

```typescript
// next.config.ts 주석 (실제 프로젝트 코드)
// C-02 수정: DATABASE_URL은 서버 전용 환경변수.
// Next.js env 섹션에 두면 클라이언트 번들(window.__NEXT_DATA__)에 노출됨.
// process.env로 서버에서만 참조.

// 올바른 패턴:
// NEXT_PUBLIC_API_GATEWAY_URL  → 클라이언트에서 사용 가능 (공개 URL)
// DATABASE_URL                 → 서버 컴포넌트에서만 사용 (절대 PUBLIC 금지)
// JWT_SECRET                   → 서버에서만 사용 (절대 PUBLIC 금지)
```

---

## 6. 로컬 k3s 개발 환경

### 6.1 WSL2 + k3s 환경 구성 (이 프로젝트 환경)

이 프로젝트의 개발 환경은 Linux 6.6.87.2 (WSL2)에서 k3s로 구성됩니다.

```bash
# k3s 설치 (WSL2)
curl -sfL https://get.k3s.io | sh -

# k3s 상태 확인
sudo systemctl status k3s

# kubectl 설정 (k3s는 /etc/rancher/k3s/k3s.yaml에 kubeconfig 생성)
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $USER ~/.kube/config

# 클러스터 확인
kubectl get nodes
# NAME         STATUS   ROLES                  AGE
# wsl-dev      Ready    control-plane,master   1m
```

### 6.2 개발 환경에서 서비스 접근 방법

```bash
# 방법 1: Port-forward — 특정 서비스를 로컬 포트로 포워딩
kubectl port-forward svc/portal 4000:4000 -n public-saas
# http://localhost:4000 으로 포털 접근

# 방법 2: NodePort 서비스
kubectl get svc -n public-saas
# portal-nodeport  NodePort  10.96.x.x  <none>  4000:30400/TCP
# http://localhost:30400 으로 접근 (k3s에서는 노드 IP = localhost)

# 방법 3: 네임스페이스 내 직접 접근 (테스트 Pod 활용)
kubectl run test-pod --rm -it --image=busybox -n public-saas -- sh
# 컨테이너 내에서: wget -O- http://portal:4000
```

### 6.3 Telepresence 대안 — 로컬 코드로 클러스터 서비스 교체

Telepresence는 로컬에서 실행 중인 서비스를 k8s 클러스터 안의 서비스처럼 동작시킵니다. 이를 통해 IDE 디버거를 연결하면서 실제 클러스터 환경을 사용할 수 있습니다.

```bash
# Telepresence 설치
curl -fL https://github.com/telepresenceio/telepresence/releases/latest/download/telepresence-linux-amd64 -o /usr/local/bin/telepresence
chmod +x /usr/local/bin/telepresence

# 클러스터에 연결
telepresence connect

# 클러스터의 auth-service를 로컬 프로세스로 교체
telepresence intercept auth-service --port 3001

# 이제 클러스터 내 모든 서비스가 로컬 auth-service로 트래픽 전송
# IDE에서 중단점 설정하고 디버깅 가능

# 종료
telepresence leave auth-service
telepresence quit
```

**Telepresence가 없을 때 대안:**

```bash
# 방법 1: 서비스 Port-Forward로 DB에 직접 연결
kubectl port-forward svc/postgresql 5432:5432 -n public-saas

# .env.local에서 로컬 개발 시 클러스터 DB 사용
DATABASE_URL="postgresql://saas:password@localhost:5432/saas"

# 방법 2: docker-compose로 의존 서비스만 로컬 실행
docker compose up -d postgresql redis  # 의존 서비스만
pnpm --filter @public-saas/auth-service dev  # 앱은 로컬 실행
```

### 6.4 로컬 이미지 빌드 및 k3s 배포

```bash
# 로컬에서 이미지 빌드
docker build -t auth-service:dev ./platform/services/auth-service

# k3s는 자체 containerd를 사용하므로 이미지를 k3s에 import
sudo k3s ctr images import <(docker save auth-service:dev)

# 이미지 확인
sudo k3s ctr images ls | grep auth-service

# 배포 업데이트
kubectl set image deployment/auth-service auth-service=auth-service:dev -n public-saas
```

---

## 7. 커밋 전 자동 검사

### 7.1 검사 체인 전체 구조

```mermaid
flowchart LR
    A["git commit\n실행"] --> B["husky\npre-commit 훅"]
    B --> C["lint-staged\n변경된 파일만"]
    C --> D["ESLint\n--fix 자동 수정"]
    D --> E["Prettier\n포매팅 통일"]
    E --> F["TypeScript\n타입 검사"]
    F --> G{검사 통과?}
    G -->|실패| H["커밋 중단\n오류 표시"]
    G -->|통과| I["commit-msg 훅\n커밋 메시지 검증"]
    I --> J["commitlint\nConventional Commits 형식"]
    J --> K{형식 맞음?}
    K -->|실패| L["커밋 중단\n올바른 형식 안내"]
    K -->|통과| M["커밋 성공"]

    style H fill:#f8d7da
    style L fill:#f8d7da
    style M fill:#d4edda
```

### 7.2 husky + lint-staged 설정

```bash
# husky 초기 설정 (이미 설정되어 있다면 스킵)
pnpm dlx husky init

# pre-commit 훅 내용 확인
cat .husky/pre-commit
# #!/usr/bin/env sh
# . "$(dirname -- "$0")/_/husky.sh"
# pnpm lint-staged
```

```json
// package.json (루트) — lint-staged 설정
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,yaml,yml,md}": [
      "prettier --write"
    ],
    "*.prisma": [
      "prisma format"
    ]
  }
}
```

### 7.3 commitlint — 커밋 메시지 형식 강제

```javascript
// commitlint.config.js (실제 프로젝트 파일)
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat',      // 새 기능
      'fix',       // 버그 수정
      'docs',      // 문서 변경
      'refactor',  // 코드 리팩토링 (기능 변화 없음)
      'test',      // 테스트 추가/수정
      'chore',     // 빌드, 도구, 설정 변경
      'perf',      // 성능 개선
      'ci',        // CI/CD 변경
      'revert',    // 이전 커밋 되돌리기
    ]],
    'scope-case': [2, 'always', 'kebab-case'],
    'subject-max-length': [2, 'always', 100],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
  },
};
```

**올바른 커밋 메시지 예시:**

```bash
# 기능 추가
git commit -m "feat(tenant): FR-TEN.1 테넌트 생성 Server Action 구현"

# 버그 수정
git commit -m "fix(auth): JWT 만료 시 토큰 갱신 오류 수정"

# CSAP 요건 추가
git commit -m "feat(portal): CSAP D-06 감사 로그 audit-service 연동"

# 잘못된 예시 (commitlint가 차단):
git commit -m "테넌트 생성 API 추가"  # type 없음
git commit -m "FEAT: something"         # 대문자 금지
```

### 7.4 knip — Dead Code 탐지

```bash
# knip 설치 및 실행 (미사용 export, 파일 탐지)
pnpm dlx knip --tsConfig platform/apps/portal/tsconfig.json

# 결과 예시:
# Unused exports (1)
# portal/src/lib/old-helper.ts: unusedFunction
#
# → Dead Code 정책: 즉시 제거 또는 // NOTE: 미사용, 이유: XXX 주석

# 전체 workspace dead code 감사
npm run audit:dead-code  # package.json scripts에 정의됨
```

---

## 8. Turbo 캐시 최적화

### 8.1 Turbo 캐시 동작 원리

Turbo는 작업의 입력(소스 파일, 환경 변수)이 같으면 이전에 실행한 결과를 재사용합니다.

```
캐시 키 계산:
  소스 파일 해시 + 환경 변수 + turbo.json 설정
  → 같으면 캐시 히트 → 즉시 결과 반환
  → 다르면 실제 실행 → 결과 캐시에 저장
```

### 8.2 turbo.json 설정

```json
// turbo.json (루트)
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],  // 의존 패키지 먼저 빌드
      "outputs": [".next/**", "dist/**"],
      "env": ["NODE_ENV", "NEXT_PUBLIC_API_GATEWAY_URL"]
      // env에 명시된 환경변수 변경 시 캐시 무효화
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "env": ["NODE_ENV", "DATABASE_URL"]
    },
    "lint": {
      "outputs": []  // lint는 산출물 없음
    },
    "dev": {
      "cache": false,   // dev 서버는 캐시 사용 안 함
      "persistent": true
    }
  }
}
```

### 8.3 원격 캐시 설정 (팀 공유)

팀원들이 서로의 빌드 결과를 재사용하려면 원격 캐시를 설정합니다.

```bash
# Turbo Remote Cache 서버 (자체 호스팅 — 공공기관 외부 클라우드 사용 불가)
# Gitea Actions 캐시 또는 자체 S3 호환 스토리지 활용

# 환경 변수 설정 (팀원 공유)
export TURBO_TOKEN="your-remote-cache-token"
export TURBO_TEAM="public-saas-team"
export TURBO_REMOTE_CACHE_PROVIDER="custom"
export TURBO_REMOTE_CACHE_API_URL="http://gitea.saas.go.kr/api/v1/turbo-cache"

# 빌드 시 원격 캐시 활용
pnpm dlx turbo build --team=public-saas-team

# 캐시 히트율 확인
pnpm dlx turbo build --summarize
# Tasks: 12 successful, 12 total
# Cached: 10 cached, 12 total  ← 10개는 캐시에서 즉시 반환
# Time: 8.5s >>> FULL TURBO
```

---

## 9. DORA Four Keys

### 9.1 개인 개발자의 DORA 지표 측정

DORA(DevOps Research and Assessment) Four Keys는 팀 차원의 지표이지만, 개인 개발자도 자신의 속도를 측정할 수 있습니다.

```
DORA Four Keys:
1. 배포 빈도 (Deployment Frequency)
   - 좋음: 주 1회 이상 배포
   - 측정: git log --oneline | wc -l (주간 커밋 수)

2. 변경 리드타임 (Lead Time for Changes)
   - 좋음: 코드 커밋 → 운영 배포 < 1일
   - 측정: 브랜치 생성 → 머지 시간

3. 서비스 복구 시간 (Time to Restore)
   - 좋음: < 1시간
   - 측정: 인시던트 생성 → 해결 시간

4. 변경 실패율 (Change Failure Rate)
   - 좋음: < 5%
   - 측정: 롤백된 배포 / 전체 배포
```

### 9.2 개인 DORA 측정 스크립트

```bash
# 이번 주 커밋 빈도 확인 (Deployment Frequency 근사치)
git log --since="1 week ago" --oneline --author="$(git config user.email)" | wc -l

# 브랜치 리드타임 측정 (feat/* 브랜치)
git log --merges --since="1 month ago" --pretty=format:"%H %s" | while read hash msg; do
  merge_time=$(git show --format="%ci" $hash | head -1)
  branch_name=$(echo $msg | grep -oP 'feat/\S+')
  if [ -n "$branch_name" ]; then
    echo "머지: $merge_time | $branch_name"
  fi
done

# DORA 지표 대시보드 (이 프로젝트에 dora-exporter 패키지 있음)
pnpm --filter @public-saas/dora-exporter build
node packages/dora-exporter/dist/index.js --report-only
```

### 9.3 DORA 지표를 높이는 개발 습관

```
배포 빈도 높이기:
  - 작은 단위로 커밋/PR (하루 1~3개 PR)
  - 기능 플래그(feature-flag-sdk) 활용 → 불완전 기능도 안전하게 배포

변경 리드타임 줄이기:
  - PR 크기 최소화 (200줄 이하 목표)
  - 자동화된 테스트로 수동 QA 시간 단축
  - 리뷰 요청 즉시 처리 (방치 금지)

서비스 복구 시간 줄이기:
  - 롤백 절차 미리 준비 (kubectl rollout undo)
  - 모니터링 알림 설정 (Grafana 대시보드)
  - Runbook 작성 (docs/09-troubleshooting/)

변경 실패율 낮추기:
  - 커밋 전 검사 체인 엄수 (husky + lint-staged)
  - Canary 배포 활용 (10% → 50% → 100%)
  - E2E 테스트 커버리지 확대
```

---

## 10. 팀 개발 워크플로우

### 10.1 전체 개발 프로세스 시퀀스 다이어그램

```mermaid
sequenceDiagram
    participant Dev as 개발자
    participant Local as 로컬 환경
    participant Git as Gitea
    participant CI as CI/CD (Gitea Actions)
    participant Review as 코드 리뷰어
    participant Staging as Staging (k3s)
    participant Prod as Production

    Dev->>Local: 1. 기능 브랜치 생성\ngit checkout -b feat/FR-XXX
    Dev->>Local: 2. Plan + Design 문서 작성\n(구현 전 필수)
    Dev->>Local: 3. 코드 구현\n(CSAP 패턴 적용)
    Dev->>Local: 4. 테스트 작성 + 실행\npnpm test
    Dev->>Local: 5. 로컬 검사\npnpm lint + pnpm build
    Dev->>Git: 6. git push origin feat/FR-XXX
    Git->>CI: 7. CI 파이프라인 시작\n(Gitea Actions)
    CI->>CI: 8. 자동 검사\nlint + typecheck + test
    CI->>CI: 9. 보안 스캔\nnpm audit + SAST
    CI->>CI: 10. Docker 빌드
    CI->>Git: 11. 검사 결과 PR에 표시

    Dev->>Git: 12. PR 생성\n(설명, FR ID, CSAP 연계 명시)
    Git->>Review: 13. 리뷰 요청 알림
    Review->>Git: 14. 코드 리뷰\n(CSAP 패턴 확인)

    alt 수정 필요
        Review->>Dev: 15a. 수정 요청
        Dev->>Local: 15b. 수정 후 재push
    else 승인
        Review->>Git: 15c. Approve + Merge
    end

    Git->>CI: 16. main 머지 → Staging 자동 배포
    CI->>Staging: 17. Staging 배포
    Dev->>Staging: 18. Staging 검증
    Dev->>Git: 19. 릴리즈 태그\ngit tag v1.x.x
    Git->>CI: 20. Production 배포 파이프라인
    CI->>Prod: 21. Canary 배포 (10%)
    Dev->>Prod: 22. Canary 모니터링 (15분)
    CI->>Prod: 23. 전체 배포 (100%)
```

### 10.2 브랜치 전략

```
main            — 배포 가능한 코드 (직접 push 금지)
│
├── feat/FR-001-tenant-create    — 기능 개발
├── feat/FR-002-user-rbac
├── fix/BUG-401-auth-token
├── docs/GUIDE-DEV-43-dx-guide
└── refactor/dead-code-cleanup
```

```bash
# 브랜치 생성 규칙
git checkout -b feat/FR-{ID}-{짧은설명}   # 기능 (Plan ID 포함)
git checkout -b fix/BUG-{ID}-{짧은설명}   # 버그 수정
git checkout -b docs/{문서ID}-{주제}        # 문서
git checkout -b refactor/{모듈}-{내용}      # 리팩토링

# 브랜치에서 최신 main 동기화 (자주 할수록 좋음)
git fetch origin
git rebase origin/main  # merge 대신 rebase로 히스토리 정리
```

### 10.3 PR 작성 체크리스트

```markdown
## PR 제목 (Conventional Commits 형식)
feat(tenant): FR-TEN.1 테넌트 생성 Server Action 구현

## 관련 FR ID
- FR-TEN.1: 테넌트 생성
- FR-TEN.2: 테넌트 활성화

## CSAP 준수 확인
- [x] D-08: getAuthContext() + isSuperAdmin() 검사 적용
- [x] D-06: sendAuditLog() 호출 (TENANT_CREATE)
- [x] D-12: Zod 스키마 입력 검증
- [x] D-12: 에러 메시지에 DB 정보 미노출

## 테스트
- [x] 단위 테스트: createTenantAction.test.ts (커버리지 85%)
- [x] 빌드 통과: pnpm build
- [x] 린트 통과: pnpm lint

## 스크린샷 / 실행 결과
(필요시 첨부)
```

---

## 11. IDE 통합 도구

### 11.1 Prisma Studio — 데이터베이스 GUI

```bash
# 로컬에서 Prisma Studio 실행
cd /data/ai-saas
pnpm dlx prisma studio

# 또는 특정 서비스 prisma 설정 사용
pnpm --filter @public-saas/workspace exec prisma studio

# 브라우저 자동 오픈: http://localhost:5555
# - 테이블 데이터 조회/수정
# - 관계 탐색 (Tenant → Users → Subscriptions)
# - 마이그레이션 확인
```

**k3s DB에 연결하는 방법:**

```bash
# 1. k3s PostgreSQL을 로컬로 포워딩
kubectl port-forward svc/postgresql 5432:5432 -n public-saas &

# 2. .env.local에서 연결 정보 설정
DATABASE_URL="postgresql://saas:password@localhost:5432/saas"

# 3. Prisma Studio 실행
pnpm dlx prisma studio
```

### 11.2 K9s — Kubernetes TUI (터미널 UI)

```bash
# K9s 설치
curl -sS https://webinstall.dev/k9s | bash

# 시작
k9s

# 자주 쓰는 K9s 단축키
# :pods         → Pod 목록
# :svc          → Service 목록
# :deploy       → Deployment 목록
# :ns           → Namespace 변경
# /auth         → "auth" 포함 리소스 필터
# l             → 선택된 Pod의 로그 보기
# d             → describe (상세 정보)
# shift+d       → 삭제
# ctrl+b        → 이전 화면
```

K9s에서 자주 하는 작업:

```
1. 서비스 상태 확인:
   :pods → 네임스페이스에서 auth-service Pod 선택 → l (로그)

2. 서비스 재시작:
   :deploy → auth-service 선택 → r (rollout restart)

3. 컨테이너 접속:
   :pods → Pod 선택 → s (shell)
   → 컨테이너 내에서 curl로 다른 서비스 테스트
```

### 11.3 Grafana — 모니터링 대시보드 로컬 접근

```bash
# k3s Grafana를 로컬로 포워딩
kubectl port-forward svc/grafana 3000:3000 -n monitoring

# 브라우저: http://localhost:3000
# 기본 로그인: admin / prom-operator

# 주요 대시보드:
# - Node Exporter: 서버 CPU, 메모리, 디스크
# - Kubernetes: Pod 상태, 네트워크 트래픽
# - Fastify: 각 서비스 응답 시간, 오류율
# - PostgreSQL: 쿼리 성능, 연결 수
```

### 11.4 VS Code에서 통합 접근 — 터미널 분할 활용

생산적인 개발을 위한 VS Code 터미널 레이아웃:

```
┌─────────────────────────────────────────────────────────┐
│  VS Code 에디터 영역                                      │
│  (코드 편집)                                              │
├───────────────┬───────────────┬─────────────────────────┤
│  터미널 1     │  터미널 2     │  터미널 3               │
│  (개발 서버)  │  (k9s / 로그) │  (git / claude)         │
│               │               │                         │
│  $ pnpm dev   │  $ k9s        │  $ git status           │
│               │  또는         │  또는                   │
│  포털 실행 중 │  $ kubectl    │  $ claude               │
│               │  logs -f ...  │                         │
└───────────────┴───────────────┴─────────────────────────┘
```

```bash
# VS Code 통합 터미널에서 탭 분할
# Ctrl+Shift+5 — 터미널 분할
# 각 터미널에서:
# 터미널 1: pnpm --filter @public-saas/portal dev
# 터미널 2: k9s (또는 kubectl logs -f 서비스Pod -n public-saas)
# 터미널 3: git 작업 + claude
```

### 11.5 REST Client — API 테스트 파일

```http
# /data/ai-saas/platform/apps/portal/src/test.http
# VS Code REST Client 익스텐션으로 클릭만으로 API 테스트

@baseUrl = http://localhost:4000
@adminToken = Bearer eyJhbGciOiJIUzI1NiJ9...

### 대시보드 통계 조회
GET {{baseUrl}}/api/dashboard/stats
Authorization: {{adminToken}}
x-user-id: user-admin-001
x-user-tenant-id: platform-internal
x-user-role: SUPER_ADMIN

### 테넌트 목록 조회
GET {{baseUrl}}/api/tenants?page=1&limit=10
Authorization: {{adminToken}}
x-user-id: user-admin-001
x-user-role: SUPER_ADMIN

### 감사 로그 조회
GET {{baseUrl}}/api/audit-logs
Authorization: {{adminToken}}
x-user-id: user-admin-001
x-user-role: SUPER_ADMIN
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-13 | 최초 작성 — DX 완전 가이드 | Implementer |

---

*본 문서는 `/data/ai-saas/CLAUDE.md`, `/data/ai-saas/.claude/` 실제 설정 파일을 직접 분석하여 작성되었습니다. 설정 변경 시 이 문서도 함께 업데이트해야 합니다.*
