# Day 1 완벽 가이드 — 오늘 반드시 해내야 할 것들

> **문서 ID**: ONBOARD-01-05
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **학습 대상**: 오늘 처음 합류한 모든 개발자
> **예상 소요 시간**: 8시간 (09:00~17:00)
> **선행 문서**: `02-environment-setup.md` (환경 설치 완료 필수)
> **목표**: `pnpm dev` 성공 + 첫 PR 초안 작성

---

## 목차

1. [오늘의 전체 흐름](#1-오늘의-전체-흐름)
2. [09:00~09:30 — 계정 발급 체크리스트](#2-090009-30--계정-발급-체크리스트)
3. [09:30~10:30 — 개발 환경 구성 및 검증](#3-093010-30--개발-환경-구성-및-검증)
4. [10:30~11:30 — 코드베이스 첫 탐험](#4-103011-30--코드베이스-첫-탐험)
5. [11:30~12:00 — 필수 보안 규칙 숙지](#5-113012-00--필수-보안-규칙-숙지)
6. [12:00~13:00 — 점심 (휴식)](#6-120013-00--점심-휴식)
7. [13:00~14:00 — 첫 서비스 로컬 실행](#7-130014-00--첫-서비스-로컬-실행)
8. [14:00~15:00 — auth-service 코드 따라가기](#8-140015-00--auth-service-코드-따라가기)
9. [15:00~16:00 — 첫 PR 초안 작성 연습](#9-150016-00--첫-pr-초안-작성-연습)
10. [16:00~17:00 — 팀 데일리 스탠드업 참여 준비](#10-160017-00--팀-데일리-스탠드업-참여-준비)
11. [계정 발급 상세 순서](#11-계정-발급-상세-순서)
12. [처음 실행하는 명령어 TOP 10](#12-처음-실행하는-명령어-top-10)
13. [절대 하면 안 되는 5가지](#13-절대-하면-안-되는-5가지)
14. [팀 리드에게 반드시 물어볼 것 5가지](#14-팀-리드에게-반드시-물어볼-것-5가지)
15. [학습 체크리스트](#학습-체크리스트)
16. [다음 단계](#다음-단계)

---

## 1. 오늘의 전체 흐름

첫날은 "잘 모르는 게 당연한 날"입니다. 코드를 완벽히 이해하려 하지 말고,
전체 구조를 파악하고 개발 환경이 작동하는지 확인하는 것이 목표입니다.

```mermaid
gantt
    title Day 1 타임라인 (8시간)
    dateFormat HH:mm
    axisFormat %H:%M

    section 오전
    계정 발급 체크리스트        :a1, 09:00, 30m
    개발 환경 구성 및 검증      :a2, 09:30, 60m
    코드베이스 첫 탐험          :a3, 10:30, 60m
    필수 보안 규칙 숙지         :a4, 11:30, 30m

    section 점심
    점심 및 휴식                :crit, lunch, 12:00, 60m

    section 오후
    첫 서비스 로컬 실행         :p1, 13:00, 60m
    auth-service 코드 따라가기  :p2, 14:00, 60m
    첫 PR 초안 작성 연습        :p3, 15:00, 60m
    스탠드업 참여 준비          :p4, 16:00, 60m
```

### 오늘의 성공 기준

| 시간대 | 달성해야 할 것 |
|--------|--------------|
| 오전 | 모든 계정 발급 완료 + 코드 클론 성공 |
| 오후 | `pnpm dev` 실행 성공 + 첫 PR 초안 작성 |
| 퇴근 전 | 내일 어떤 서비스를 더 깊게 볼지 결정 |

---

## 2. 09:00~09:30 — 계정 발급 체크리스트

### 이 시간에 해야 할 것

입사 첫날 가장 먼저 해야 할 일은 개발에 필요한 모든 계정을 발급받는 것입니다.
팀 리드 또는 인프라 담당자에게 요청하십시오.

```mermaid
flowchart LR
    START([입사 첫날 시작]) --> GITEA
    GITEA[Gitea 계정\n코드 저장소] --> K3S
    K3S[k3s 클러스터\n접근 권한] --> VAULT
    VAULT[HashiCorp Vault\n시크릿 관리] --> SLACK
    SLACK[Slack 팀 채널\n입장] --> DONE([계정 발급 완료])

    style START fill:#1565C0,color:#fff
    style DONE fill:#2E7D32,color:#fff
```

### 체크리스트

- [ ] **Gitea 계정** — 코드 저장소 접근
  - 팀 리드에게 계정 생성 요청
  - 이메일로 초대 링크 수신 후 비밀번호 설정
  - 본인 SSH 키 등록 (`~/.ssh/id_ed25519.pub` 내용 복사)

- [ ] **k3s 클러스터 접근** — Kubernetes 개발 클러스터
  - 인프라 담당자에게 kubeconfig 파일 요청
  - `~/.kube/config`에 저장
  - `kubectl get pods -n ai-saas` 로 접근 확인

- [ ] **HashiCorp Vault 접근** — 시크릿/환경변수 관리
  - Vault URL과 토큰을 팀 리드에게 요청
  - 개발 환경 시크릿은 Vault에서만 가져옵니다
  - 절대로 `.env` 파일에 실제 키를 커밋하지 마십시오

- [ ] **Slack 채널** — 팀 커뮤니케이션
  - `#dev-general`: 일반 개발 논의
  - `#ci-alerts`: CI/CD 빌드 알림 자동 수신
  - `#security-alerts`: 보안 알림 (CSAP D-06)
  - `#standup`: 매일 오전 9시 스탠드업

### 막히면 확인할 곳

- 팀 리드 직접 연락 (Slack `@팀리드명`)
- `docs/guides/infra/accounts-setup.md` (계정 발급 절차 상세)

### 성공 기준

모든 4개 계정 발급 완료 + Gitea에 본인 아이디로 로그인 가능

---

## 3. 09:30~10:30 — 개발 환경 구성 및 검증

### 이 시간에 해야 할 것

`02-environment-setup.md`에서 설치한 모든 도구가 정상 작동하는지 최종 확인합니다.
그 다음 프로젝트 코드를 클론하고 첫 빌드를 실행합니다.

- [ ] 모든 도구 버전 확인 (아래 스크립트 실행)
- [ ] Gitea에서 SSH 클론 또는 HTTPS 클론
- [ ] `pnpm install` 실행
- [ ] `pnpm build` 실행 (오류 없이 완료 확인)

### 환경 최종 검증 스크립트

```bash
#!/bin/bash
# 개발 환경 전체 검증 — Day 1 필수 실행
echo "=== Day 1 환경 검증 시작 ==="

# Node.js
echo -n "Node.js: "
node --version || echo "FAIL — 설치 필요"

# pnpm
echo -n "pnpm: "
pnpm --version || echo "FAIL — 설치 필요"

# Docker
echo -n "Docker: "
docker version --format '{{.Client.Version}}' 2>/dev/null || echo "FAIL — Docker Desktop 실행 확인"

# k3s
echo -n "kubectl: "
kubectl get nodes 2>/dev/null || echo "FAIL — k3s 실행 필요"

# Git
echo -n "Git: "
git --version || echo "FAIL — 설치 필요"

# Claude Code
echo -n "Claude Code: "
claude --version 2>/dev/null || echo "FAIL — 설치 필요"

echo ""
echo "=== 검증 완료 ==="
```

```bash
# 출력 예시 (모두 정상일 때)
# Node.js: v22.13.1
# pnpm: 9.15.0
# Docker: 26.1.3
# kubectl: NAME  STATUS  ...  Ready  ...
# Git: git version 2.43.0
# Claude Code: 1.x.x
```

### 프로젝트 클론 및 첫 빌드

```bash
# 1. 프로젝트 클론 (SSH 방식 — 팀 리드에게 URL 확인)
git clone git@gitea.internal:public-saas/ai-saas.git /data/ai-saas

# 이미 클론되어 있다면 최신 코드 받기
cd /data/ai-saas
git checkout main
git pull

# 2. 브랜치 확인 (현재 어느 브랜치인지 확인)
git branch
# * main  ← 이렇게 표시되어야 합니다

# 3. 의존성 설치
pnpm install
# 수백 개의 패키지가 설치됩니다. 5~10분 소요될 수 있습니다.

# 4. 전체 빌드
pnpm build
# 성공 시: Tasks: N successful, 0 failed
```

### 막히면 확인할 곳

- `02-environment-setup.md` — 섹션 11 "자주 발생하는 설치 오류 해결법"
- Slack `#dev-general`에 오류 메시지 공유

### 성공 기준

`pnpm build` 명령이 `Tasks: N successful, 0 failed` 메시지와 함께 완료

---

## 4. 10:30~11:30 — 코드베이스 첫 탐험

### 이 시간에 해야 할 것

코드 전체를 이해하려 하지 마십시오. 큰 그림을 파악하는 것이 목표입니다.
다음 순서로 탐험하십시오.

- [ ] 최상위 디렉토리 구조 파악
- [ ] `platform/services/` 아래 서비스 목록 확인
- [ ] `CLAUDE.md` 정독 (프로젝트 규칙의 핵심)
- [ ] 아키텍처 개요 문서 빠르게 읽기

### 디렉토리 구조 한눈에 보기

```
/data/ai-saas/
├── CLAUDE.md                     ← 프로젝트 전체 규칙 (반드시 정독)
├── platform/
│   ├── services/                 ← 14개 마이크로서비스
│   │   ├── api-gateway/          ← 모든 외부 요청의 관문
│   │   ├── auth-service/         ← 인증/인가 (Day 1에 집중)
│   │   ├── user-service/         ← 사용자 관리
│   │   ├── tenant-service/       ← 멀티테넌트 관리
│   │   ├── ai-service/           ← AI LLM 연동 (N2SF 핵심)
│   │   ├── audit-service/        ← 감사 로그 (CSAP D-06)
│   │   ├── compliance-service/   ← CSAP 준수 검사
│   │   ├── security-service/     ← 보안 모니터링
│   │   ├── notification-service/ ← 이메일/SMS 알림
│   │   ├── subscription-service/ ← 구독 플랜 관리
│   │   └── ...
│   └── packages/                 ← 공유 라이브러리
│       ├── event-bus/            ← 서비스 간 이벤트 통신
│       ├── audit-sdk/            ← 감사 로그 SDK
│       ├── mesh-ready/           ← 서비스 메시 준비 도구
│       └── ...
├── packages/                     ← 상위 수준 패키지
│   ├── feature-flag-sdk/         ← 기능 플래그
│   ├── slo-escalation/           ← SLO 에스컬레이션
│   └── ...
├── docs/
│   ├── 01-plan/                  ← MTU Plan 문서
│   ├── 02-design/                ← Design 문서
│   └── guides/onboarding/        ← 지금 읽는 이 문서들
└── pnpm-workspace.yaml           ← 모노레포 워크스페이스 설정
```

### 탐험 순서

```bash
# 1. 최상위 구조 확인
ls /data/ai-saas/

# 2. 서비스 목록 확인
ls /data/ai-saas/platform/services/

# 3. auth-service 구조 확인 (오늘 중점적으로 볼 서비스)
ls /data/ai-saas/platform/services/auth-service/src/

# 4. 공유 패키지 확인
ls /data/ai-saas/platform/packages/

# 5. 문서 구조 확인
ls /data/ai-saas/docs/guides/onboarding/
```

```bash
# CLAUDE.md 핵심 내용 확인 (전체 읽기)
cat /data/ai-saas/CLAUDE.md
```

### 아키텍처 문서 빠르게 읽기

```
읽을 순서:
1. docs/guides/onboarding/02-architecture/01-system-overview.md
   → 전체 시스템 구조 (15분)

2. docs/guides/onboarding/02-architecture/02-multitenancy.md
   → 멀티테넌트가 무엇인지 (10분)
```

### 막히면 확인할 곳

- `docs/guides/onboarding/02-architecture/README.md`
- Slack `#dev-general`

### 성공 기준

"어떤 서비스가 있고, auth-service가 무슨 역할인지" 한 문장으로 설명할 수 있다면 완료

---

## 5. 11:30~12:00 — 필수 보안 규칙 숙지

### 이 시간에 해야 할 것

이 프로젝트는 공공기관 SaaS로 보안이 최우선입니다.
코드를 한 줄도 쓰기 전에 반드시 알아야 할 규칙들이 있습니다.

- [ ] CSAP가 무엇인지 이해 (공공기관 클라우드 보안 인증제)
- [ ] N2SF 데이터 등급 분류 이해 (C/S/O 등급)
- [ ] 절대 하면 안 되는 행동 목록 숙지

### 핵심 보안 규칙 요약

```mermaid
flowchart TD
    subgraph "CSAP 핵심 통제"
        D06["D-06: 감사 로그\n모든 민감 작업 기록 필수"]
        D08["D-08: 접근 제어\nRBAC 검사 필수"]
        D09["D-09: 암호화\nAES-256 저장, TLS 1.3 전송"]
        D12["D-12: 개발 보안\n입력 검증, SQL 인젝션 방지"]
    end

    subgraph "N2SF 데이터 등급"
        C["C 등급 (기밀)\nAI API 전송 절대 금지"]
        S["S 등급 (민감)\nAI API 전송 절대 금지"]
        O["O 등급 (공개)\nPII 마스킹 후 전송 가능"]
    end

    subgraph "절대 금지"
        NO1["하드코딩 시크릿\nAPI Key, 비밀번호"]
        NO2["git commit --no-verify\n훅 우회 금지"]
        NO3["git push --force\n감사 추적 파괴"]
        NO4["SQL 직접 결합\nSQL 인젝션 위험"]
    end

    style C fill:#C62828,color:#fff
    style S fill:#E65100,color:#fff
    style O fill:#1B5E20,color:#fff
    style NO1 fill:#B71C1C,color:#fff
    style NO2 fill:#B71C1C,color:#fff
    style NO3 fill:#B71C1C,color:#fff
    style NO4 fill:#B71C1C,color:#fff
```

### 꼭 기억할 규칙 3가지

**규칙 1: 시크릿은 환경 변수로만**

```typescript
// ❌ 절대 금지 — CSAP D-09 위반
const apiKey = 'sk-ant-1234567890abcdef'

// ✅ 올바른 방법 — 환경 변수 사용
const apiKey = process.env.ANTHROPIC_API_KEY
if (!apiKey) throw new Error('ANTHROPIC_API_KEY 환경 변수 누락')
```

**규칙 2: 모든 입력은 Zod로 검증**

```typescript
// ❌ 검증 없는 입력 사용 — SQL 인젝션 위험
const userId = request.body.userId  // 직접 사용 금지

// ✅ Zod 스키마로 검증 후 사용
import { z } from 'zod'
const schema = z.object({ userId: z.string().uuid() })
const { userId } = schema.parse(request.body)
```

**규칙 3: C/S 등급 데이터는 AI API 전송 금지**

```typescript
// ❌ C/S 등급 데이터를 AI로 전송 — N2SF 위반
await aiService.send({ data: classifiedDocument, grade: 'C' })

// ✅ O 등급만, PII 마스킹 후 전송
if (grade !== 'O') throw new Error('AI API 전송 금지 등급')
const masked = maskPII(data)
await aiGateway.send(masked)
```

### 막히면 확인할 곳

- `.claude/rules/csap-compliance.md` — CSAP 보안 규칙 전체
- `docs/guides/onboarding/07-security/coding/01-secure-patterns.md`

### 성공 기준

"C 등급 데이터를 AI에 보내면 안 되는 이유"를 말할 수 있으면 완료

---

## 6. 12:00~13:00 — 점심 (휴식)

오전에 많은 정보를 습득했습니다. 점심 시간에는 완전히 쉬십시오.
뇌가 정보를 정리할 시간이 필요합니다.

> 💡 **팁**: 팀원들과 함께 점심을 먹으면서 팀 문화를 파악하는 좋은 기회입니다.

---

## 7. 13:00~14:00 — 첫 서비스 로컬 실행

### 이 시간에 해야 할 것

실제로 서비스를 실행해보는 시간입니다. `auth-service`를 로컬에서 실행하고
API를 직접 호출해봅니다.

- [ ] 환경 변수 파일 `.env.local` 생성 (팀 리드에게 개발 환경 값 요청)
- [ ] `pnpm dev` 또는 특정 서비스 실행
- [ ] 헬스체크 API 호출 확인
- [ ] 로그 출력 확인

### 환경 변수 파일 설정

```bash
# 팀 리드에게 개발 환경 .env.local 파일을 요청합니다
# 직접 값을 입력하지 말고 Vault에서 가져온 값을 사용합니다

# auth-service 디렉토리
cd /data/ai-saas/platform/services/auth-service

# .env.local 예시 구조 (실제 값은 팀 리드에게 요청)
cat > .env.local << 'EOF'
# 데이터베이스 (개발 환경)
DATABASE_URL=postgresql://dev_user:dev_pass@localhost:5432/auth_dev

# JWT 시크릿 (개발 환경용 임시 값 — 운영 값 절대 사용 금지)
JWT_SECRET=dev-only-not-for-production

# 서비스 포트
PORT=3001

# 로그 레벨
LOG_LEVEL=debug
EOF
```

> ⚠️ **중요**: `.env.local` 파일을 절대 `git add` 하지 마십시오.
> `.gitignore`에 이미 포함되어 있어야 합니다. 확인 후 진행하십시오.

```bash
# .gitignore 확인
grep -n "\.env" /data/ai-saas/.gitignore
# .env, .env.local, .env.*.local 등이 포함되어야 합니다
```

### 전체 개발 서버 실행

```bash
# 방법 1: 전체 서비스 한 번에 실행 (처음에는 느릴 수 있습니다)
cd /data/ai-saas
pnpm dev

# 방법 2: 특정 서비스만 실행 (권장 — 가볍게 시작)
pnpm --filter @public-saas/auth-service dev
```

### 서비스 실행 확인

```bash
# auth-service 헬스체크 (새 터미널 탭에서 실행)
curl http://localhost:3001/health

# 기대 응답:
# {
#   "status": "ok",
#   "service": "auth-service",
#   "timestamp": "2026-04-12T09:00:00.000Z"
# }
```

### 로그 읽는 방법

```
실행 로그 예시:
[2026-04-12T09:00:00.000Z] INFO: Server listening on port 3001
[2026-04-12T09:00:01.000Z] INFO: Database connected
[2026-04-12T09:00:01.000Z] INFO: auth-service ready

→ 이 3줄이 나오면 서비스가 정상 실행된 것입니다.
```

### 막히면 확인할 곳

- `platform/services/auth-service/README.md`
- Slack `#dev-general`에 오류 로그 공유

### 성공 기준

`curl http://localhost:3001/health` 응답으로 `"status": "ok"` 수신

---

## 8. 14:00~15:00 — auth-service 코드 따라가기

### 이 시간에 해야 할 것

auth-service의 로그인 API 코드를 처음부터 끝까지 따라갑니다.
요청이 들어와서 응답이 나가기까지의 전체 흐름을 이해합니다.

- [ ] `src/routes.ts` — API 라우트 등록 방식 파악
- [ ] 로그인 핸들러 찾기
- [ ] JWT 토큰 생성 로직 이해
- [ ] 감사 로그 기록 위치 확인

### 코드 탐험 순서

```bash
# 1. auth-service 소스 구조 확인
ls /data/ai-saas/platform/services/auth-service/src/
# handlers/  lib/  middleware/  routes.ts  index.ts

# 2. 라우트 파일 확인 — 어떤 API가 있는지
cat /data/ai-saas/platform/services/auth-service/src/routes.ts

# 3. 로그인 핸들러 찾기
ls /data/ai-saas/platform/services/auth-service/src/handlers/
```

### 로그인 요청 흐름 이해

```mermaid
sequenceDiagram
    participant Client as 클라이언트
    participant GW as API Gateway
    participant Auth as auth-service
    participant DB as 데이터베이스
    participant Audit as 감사 로그

    Client->>GW: POST /api/v1/auth/login<br/>{email, password}
    GW->>Auth: 요청 전달 (인증 없이 통과 — 로그인 엔드포인트)
    Auth->>Auth: Zod 스키마 검증<br/>(이메일 형식, 비밀번호 길이)
    Auth->>DB: 사용자 조회 (매개변수화 쿼리)
    DB-->>Auth: 사용자 정보 반환
    Auth->>Auth: bcrypt 비밀번호 검증
    Auth->>Auth: JWT 토큰 생성 (15분 만료)
    Auth->>Audit: 로그인 성공 감사 로그 기록
    Auth-->>GW: {token, user} 반환
    GW-->>Client: 200 OK + JWT 토큰
```

### 실제 코드에서 찾을 것들

```bash
# VS Code에서 auth-service 열기
code /data/ai-saas/platform/services/auth-service/
```

탐색하면서 다음을 찾아보십시오.

1. **Zod 검증 코드**: `z.object({ email: z.string().email(), ... })`
2. **bcrypt 비교**: `bcrypt.compare(password, user.passwordHash)`
3. **JWT 생성**: `jwt.sign({ sub: user.id, ... }, process.env.JWT_SECRET)`
4. **감사 로그**: `auditLog({ actor: user.id, action: 'LOGIN', ... })`

### 직접 API 호출해보기

```bash
# 로그인 API 직접 호출 (Thunder Client 또는 curl)
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@dev.go.kr", "password": "dev-password"}'

# 기대 응답:
# {
#   "success": true,
#   "data": {
#     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#     "user": { "id": "...", "email": "admin@dev.go.kr", "role": "ADMIN" }
#   }
# }
```

### 막히면 확인할 곳

- `docs/guides/onboarding/02-architecture/services/02-auth-service.md`
- VS Code에서 파일을 열고 `Ctrl+Shift+F`로 `loginHandler` 검색

### 성공 기준

로그인 API 코드에서 "Zod 검증 → bcrypt 비교 → JWT 생성 → 감사 로그" 4단계를 찾을 수 있으면 완료

---

## 9. 15:00~16:00 — 첫 PR 초안 작성 연습

### 이 시간에 해야 할 것

실제 코드 변경이 없어도 PR(Pull Request) 작성 방법을 연습합니다.
오늘은 연습용 브랜치를 만들고 PR 초안을 작성합니다.

- [ ] `feat/day1-practice-{본인이름}` 브랜치 생성
- [ ] `docs/`에 자기소개 텍스트 파일 작성 (연습용)
- [ ] Conventional Commits 형식으로 커밋
- [ ] PR 초안 작성 (Gitea UI에서)

### Git 브랜치 전략 이해

```mermaid
gitGraph
    commit id: "main 브랜치"
    branch feat/day1-practice-hong
    checkout feat/day1-practice-hong
    commit id: "docs: 홍길동 자기소개 추가 (연습)"
    checkout main
    merge feat/day1-practice-hong id: "PR 머지 후"
```

### 실습 단계

```bash
# 1. 연습용 브랜치 생성 (main 기반)
cd /data/ai-saas
git checkout main
git pull  # 최신 코드 받기
git checkout -b feat/day1-practice-$(whoami)
# 예시: feat/day1-practice-hong

# 2. 연습용 파일 생성
mkdir -p docs/team/introductions
cat > docs/team/introductions/$(whoami).md << 'EOF'
# 자기소개 (연습용 PR)

- 이름: 홍길동
- 합류일: 2026-04-12
- 담당 예정 영역: auth-service, user-service
- 오늘 배운 것: 코드베이스 구조, 보안 규칙, auth-service 흐름
EOF

# 3. 변경사항 확인
git status
git diff

# 4. 스테이지에 올리기
git add docs/team/introductions/$(whoami).md

# 5. Conventional Commits 형식으로 커밋
git commit -m "docs: $(whoami) 팀 합류 자기소개 추가 (Day 1 연습)"
```

### Conventional Commits 형식 설명

```
형식: {타입}({범위}): {설명}

타입 목록:
- feat:     새로운 기능
- fix:      버그 수정
- docs:     문서 변경
- refactor: 코드 구조 개선 (기능 변경 없음)
- test:     테스트 추가/수정
- chore:    빌드, 설정 변경

예시:
feat(auth): FR-2.1 로그인 실패 횟수 제한 추가
fix(tenant): 멀티테넌트 격리 쿼리 누락 수정
docs(api): 로그인 API 응답 스키마 추가
```

### Gitea에서 PR 생성

```bash
# Gitea URL 확인 (팀 리드에게 확인)
# 예시: https://gitea.internal/public-saas/ai-saas

# 브랜치를 원격에 push
git push -u origin feat/day1-practice-$(whoami)

# Gitea 웹 UI에서:
# 1. 본인 브랜치 선택
# 2. "New Pull Request" 클릭
# 3. 제목: "docs: 홍길동 팀 합류 자기소개 추가 (Day 1 연습)"
# 4. 설명: 오늘 배운 것, PR의 목적 설명
# 5. "Draft" 체크 (아직 완성이 아님을 표시)
```

### PR 설명 작성 예시

```markdown
## 변경 내용

Day 1 온보딩 연습으로 팀 자기소개 파일을 추가합니다.

## 변경 이유

Conventional Commits 형식과 PR 작성 방법을 익히기 위한 연습입니다.

## 체크리스트

- [x] Conventional Commits 형식 커밋
- [ ] 팀 리드 리뷰 요청 (연습 완료 후)

## 관련 이슈

없음 (Day 1 온보딩 연습)
```

### 막히면 확인할 곳

- `.claude/rules/harness-constraints.md` — Git 워크플로우 규칙
- Slack `#dev-general`

### 성공 기준

Gitea에 PR Draft가 생성되어 URL이 있으면 완료

---

## 10. 16:00~17:00 — 팀 데일리 스탠드업 참여 준비

### 이 시간에 해야 할 것

매일 오전(또는 팀마다 다름) 스탠드업 미팅이 있습니다.
오늘은 첫날이므로 내일 스탠드업을 준비합니다.

- [ ] 오늘 한 것 정리 (3가지)
- [ ] 내일 할 것 결정 (1~2가지)
- [ ] 막히는 것 / 도움 필요한 것 정리

### 스탠드업 형식

```
팀 스탠드업 3가지 질문:

1. 어제(오늘) 한 것:
   "환경 설정 완료, auth-service 로컬 실행 성공, PR 초안 작성 연습"

2. 오늘(내일) 할 것:
   "auth-service 단위 테스트 읽기, 첫 기능 구현 시도"

3. 막히는 것:
   "데이터베이스 마이그레이션 명령이 잘 안됨 → 팀 리드 도움 요청"
```

### 오늘 하루 회고 정리

오늘 배운 것을 메모해두면 내일이 훨씬 편합니다.

```bash
# 간단한 오늘 회고 파일 만들기 (선택 사항)
mkdir -p ~/.notes
cat >> ~/.notes/ai-saas-learning.md << 'EOF'

## 2026-04-12 Day 1

### 오늘 한 것
- [ ] 계정 발급 완료 (Gitea, k3s, Vault, Slack)
- [ ] pnpm build 성공
- [ ] auth-service 로컬 실행 성공
- [ ] 첫 PR 초안 작성

### 배운 것
- CSAP D-06/08/09/12가 코드에 어떻게 반영되는지
- N2SF C/S 등급 데이터는 AI API 전송 불가
- Conventional Commits 형식

### 아직 모르는 것
- Prisma 마이그레이션 방법
- k8s에 실제 배포하는 방법
- CI/CD 파이프라인 전체 흐름
EOF
```

### 성공 기준 최종 확인

```mermaid
graph TD
    subgraph "Day 1 완료 기준"
        C1["계정 발급\n4개 완료"] --> CHECK1{완료?}
        C2["pnpm build\n성공"] --> CHECK2{완료?}
        C3["auth-service\n로컬 실행"] --> CHECK3{완료?}
        C4["PR 초안\n작성"] --> CHECK4{완료?}

        CHECK1 -->|예| OK1[✅]
        CHECK1 -->|아니오| FAIL1[내일 오전 완료 목표]
        CHECK2 -->|예| OK2[✅]
        CHECK2 -->|아니오| FAIL2[팀 리드 도움 요청]
        CHECK3 -->|예| OK3[✅]
        CHECK3 -->|아니오| FAIL3[내일 오전 재시도]
        CHECK4 -->|예| OK4[✅]
        CHECK4 -->|아니오| FAIL4[내일 오전 완료 목표]
    end

    style OK1 fill:#2E7D32,color:#fff
    style OK2 fill:#2E7D32,color:#fff
    style OK3 fill:#2E7D32,color:#fff
    style OK4 fill:#2E7D32,color:#fff
```

---

## 11. 계정 발급 상세 순서

### 11.1 Gitea 계정 발급

Gitea는 이 프로젝트의 코드 저장소이자 CI/CD 파이프라인의 핵심입니다.

```
발급 절차:
1. 팀 리드에게 Gitea 관리자 계정으로 초대 요청
2. 이메일로 수신한 초대 링크로 비밀번호 설정
3. https://gitea.internal 에 로그인
4. Settings > SSH/GPG Keys에 본인 공개 키 등록

SSH 키 생성 방법 (WSL2 터미널):
```

```bash
# SSH 키 생성 (이미 있다면 건너뜀)
ls ~/.ssh/id_ed25519 2>/dev/null || ssh-keygen -t ed25519 -C "hong@agency.go.kr"

# 공개 키 내용 확인 (이것을 Gitea에 등록)
cat ~/.ssh/id_ed25519.pub
# 출력 예: ssh-ed25519 AAAAC3NzaC1lZDI1NTE5... hong@agency.go.kr

# SSH 연결 테스트
ssh -T git@gitea.internal
# 성공: Hi hong! You've successfully authenticated...
```

### 11.2 k3s 클러스터 접근

```bash
# 인프라 담당자에게 kubeconfig 파일 수신
# 파일을 ~/.kube/config에 저장

# 기존 config 있으면 백업
mv ~/.kube/config ~/.kube/config.backup 2>/dev/null || true

# 새 config 적용 (파일을 전달받은 경로로 수정)
cp /tmp/dev-kubeconfig.yaml ~/.kube/config
chmod 600 ~/.kube/config

# 접근 확인
kubectl get namespaces
# 출력 예:
# NAME          STATUS   AGE
# ai-saas       Active   30d
# monitoring    Active   30d
```

### 11.3 HashiCorp Vault 접근

```bash
# Vault CLI 설치 (아직 없다면)
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install vault -y

# Vault 주소와 토큰 설정 (팀 리드에게 수신)
export VAULT_ADDR='https://vault.internal'
export VAULT_TOKEN='hvs.XXXXXXXX'  # 실제 토큰으로 교체

# 접근 확인
vault status

# 개발 환경 시크릿 확인
vault kv get secret/ai-saas/dev/auth-service
```

### 11.4 Slack 채널 입장

```
Slack 채널 목록:
#dev-general      — 일반 개발 논의, 질문 환영
#ci-alerts        — CI/CD 빌드 결과 자동 알림
#security-alerts  — 보안 이벤트 알림 (CSAP D-06)
#standup          — 매일 9시 텍스트 스탠드업
#incident         — 장애 대응 (평소에는 조용함)

입장 방법:
1. Slack 워크스페이스 초대 링크 수신 (팀 리드에게 요청)
2. 이메일로 수신한 초대 링크로 가입
3. 위 채널들을 검색하여 가입 (Join Channel)
```

---

## 12. 처음 실행하는 명령어 TOP 10

Day 1에 가장 자주 사용하게 될 명령어들입니다. 각 명령어의 의미를 이해하며 실행하십시오.

| 순위 | 명령어 | 설명 |
|------|--------|------|
| 1 | `pnpm install` | 모든 서비스의 npm 패키지 설치 |
| 2 | `pnpm build` | 전체 프로젝트 TypeScript 컴파일 및 빌드 |
| 3 | `pnpm dev` | 전체 개발 서버 실행 (핫리로드 포함) |
| 4 | `git status` | 변경된 파일 목록 확인 |
| 5 | `git log --oneline -10` | 최근 커밋 10개 한 줄로 확인 |
| 6 | `kubectl get pods -n ai-saas` | 개발 클러스터에 실행 중인 Pod 확인 |
| 7 | `pnpm test` | 전체 단위 테스트 실행 |
| 8 | `pnpm lint` | ESLint 코드 품질 검사 |
| 9 | `k9s` | Kubernetes TUI 관리 도구 실행 |
| 10 | `claude` | Claude Code AI 코딩 도우미 실행 |

### 각 명령어 상세 설명

```bash
# 1. pnpm install
# 언제: 처음 클론 후, package.json이 변경됐을 때
pnpm install
# 효과: node_modules/ 디렉토리 생성, 모든 의존성 설치

# 2. pnpm build
# 언제: TypeScript 코드를 JavaScript로 변환할 때
pnpm build
# 효과: dist/ 또는 build/ 디렉토리에 컴파일된 파일 생성

# 3. pnpm dev
# 언제: 로컬 개발 중 (파일 변경 시 자동 재시작)
pnpm dev
# 효과: 모든 서비스를 개발 모드로 실행, 파일 변경 감지

# 4. git status
# 언제: 커밋 전 항상 확인
git status
# 효과: 수정/추가/삭제된 파일 목록 표시

# 5. git log --oneline -10
# 언제: 최근 변경사항 파악할 때
git log --oneline -10
# 효과: 최근 10개 커밋을 한 줄씩 표시

# 6. kubectl get pods -n ai-saas
# 언제: 개발 클러스터 상태 확인할 때
kubectl get pods -n ai-saas
# 효과: ai-saas 네임스페이스의 모든 Pod 상태 표시

# 7. pnpm test
# 언제: 코드 변경 후 테스트 실행
pnpm test
# 효과: 모든 *.test.ts 파일 실행, 결과 표시

# 8. pnpm lint
# 언제: 커밋 전, 코드 품질 확인
pnpm lint
# 효과: ESLint 규칙 위반 항목 표시

# 9. k9s
# 언제: Kubernetes 클러스터 모니터링
k9s
# 효과: 터미널에서 Pod, 로그, 이벤트를 시각적으로 관리

# 10. claude
# 언제: AI 코딩 도우미가 필요할 때
claude
# 효과: CLAUDE.md 규칙을 읽은 AI 에이전트와 대화
```

---

## 13. 절대 하면 안 되는 5가지

Day 1 실수 방지 목록입니다. 이 5가지만 지켜도 큰 문제는 없습니다.

### 실수 1: 하드코딩 시크릿 커밋

```typescript
// ❌ 이렇게 하면 절대 안 됩니다
const ANTHROPIC_API_KEY = 'sk-ant-api03-...'  // 실제 키 하드코딩

// 이 코드를 커밋하면:
// - CSAP D-09 위반 → 감리 결함
// - 키가 git 히스토리에 영구 기록
// - 보안팀에서 즉시 키 무효화 및 보안 리포트 발행
```

### 실수 2: `git commit --no-verify` 실행

```bash
# ❌ 절대 금지
git commit --no-verify -m "빠른 커밋"

# 이 옵션은 pre-commit 훅을 우회합니다
# 훅에서 확인하는 것: 하드코딩 시크릿, 린트 오류, 테스트 실패
# 우회하면 CI에서 실패하고 팀 전체 빌드가 깨집니다
# CLAUDE.md에서 명시적으로 금지하는 행동입니다
```

### 실수 3: `main` 브랜치에 직접 커밋

```bash
# ❌ main 브랜치에서 직접 작업 금지
git checkout main
git commit -m "직접 커밋"
git push

# 올바른 방법:
git checkout -b feat/my-feature  # 브랜치 생성
git commit -m "feat: ..."
git push -u origin feat/my-feature
# → PR 생성 → 리뷰 → 머지
```

### 실수 4: C/S 등급 데이터를 로그에 출력

```typescript
// ❌ 민감 정보를 로그에 출력하면 안 됩니다
console.log('사용자 정보:', user)  // 비밀번호, 주민번호 등 포함 가능

// ✅ 올바른 방법: 안전한 필드만 로그
console.log('사용자 ID:', user.id, '역할:', user.role)
// 또는 구조적 로거 사용
logger.info({ userId: user.id, action: 'login' }, '로그인 성공')
```

### 실수 5: `pnpm` 대신 `npm` 또는 `yarn` 사용

```bash
# ❌ 이 프로젝트에서 npm/yarn 사용 금지
npm install some-package
yarn add some-package

# npm/yarn으로 설치하면:
# - pnpm-lock.yaml과 충돌
# - 다른 팀원의 환경과 불일치
# - CI/CD에서 빌드 실패

# ✅ 항상 pnpm 사용
pnpm add some-package
pnpm remove some-package
pnpm install
```

---

## 14. 팀 리드에게 반드시 물어볼 것 5가지

Day 1에 팀 리드와 나누어야 할 핵심 질문들입니다.

### 질문 1: 담당 서비스가 무엇인지

```
"제가 처음에 집중해야 할 서비스 또는 기능이 무엇인지 알려주실 수 있나요?
 현재 스프린트에서 제가 기여할 수 있는 이슈가 있나요?"
```

처음부터 너무 넓게 보면 오히려 혼란스럽습니다. 한 서비스에 집중해서 시작하는 것이 좋습니다.

### 질문 2: 개발 환경 데이터베이스 접속 정보

```
"개발용 데이터베이스 연결 정보를 어떻게 받을 수 있나요?
 Vault에서 가져오는 방법과 .env.local 파일 작성 방법을 알려주세요."
```

환경 변수 없이는 서비스를 제대로 실행할 수 없습니다.

### 질문 3: Q-Gate 통과 기준

```
"PR을 제출할 때 Q-Gate 7단계를 모두 통과해야 한다고 알고 있는데,
 첫 PR에서 주의해야 할 게이트가 무엇인지 알려주세요.
 특히 G4(테스트 80%) 기준이 실제 어떻게 측정되는지 궁금합니다."
```

Q-Gate 기준을 미리 알면 불필요한 리젝션을 피할 수 있습니다.

### 질문 4: 코드 리뷰 문화

```
"PR 리뷰 사이클이 보통 얼마나 걸리나요?
 리뷰 전에 셀프 체크리스트가 있나요?
 리뷰어 자동 지정이 있나요, 아니면 수동으로 지정하나요?"
```

### 질문 5: 긴급 상황 연락처

```
"운영 환경에서 장애가 발생하거나 보안 이슈가 발견됐을 때
 누구에게 먼저 연락해야 하나요?
 #incident 채널 외에 다른 에스컬레이션 경로가 있나요?"
```

---

## 학습 체크리스트

Day 1이 끝날 때 다음 항목을 확인합니다.

### 계정 및 환경

- [ ] Gitea 계정 발급 및 로그인 가능
- [ ] k3s 클러스터 접근 (`kubectl get nodes` 성공)
- [ ] HashiCorp Vault 접근 가능
- [ ] Slack 팀 채널 4개 입장
- [ ] `pnpm install` 오류 없이 완료
- [ ] `pnpm build` 성공 (0 failed)

### 코드베이스 이해

- [ ] 14개 서비스 목록 파악
- [ ] auth-service의 역할 설명 가능
- [ ] `CLAUDE.md` 전체 정독 완료
- [ ] 아키텍처 개요 문서 (`01-system-overview.md`) 읽기 완료

### 보안 규칙

- [ ] CSAP D-06/08/09/12가 무엇인지 이해
- [ ] N2SF C/S/O 등급 구분 이해
- [ ] "하드코딩 시크릿 절대 금지" 규칙 이해
- [ ] Conventional Commits 형식 이해

### 실습

- [ ] auth-service 로컬 실행 성공 (`/health` 응답 확인)
- [ ] 로그인 API 코드 흐름 (4단계) 파악
- [ ] 연습용 브랜치 생성 및 커밋
- [ ] Gitea에 PR 초안 생성

### 팀 적응

- [ ] 팀 리드와 5가지 질문 논의 완료
- [ ] 내일 담당할 서비스/기능 결정
- [ ] 스탠드업 형식 파악

---

## 다음 단계

Day 1을 잘 마쳤다면 다음 문서로 이동합니다.

**[Day 2 목표: `03-first-week.md` — auth-service API 직접 호출 실습]**

- auth-service의 모든 API 엔드포인트 파악
- 로그인 → 토큰 갱신 → 로그아웃 전체 흐름 실습
- 감사 로그가 어디에 기록되는지 확인
- 첫 번째 단위 테스트 읽기

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|------|
| 1.0.0 | 2026-04-12 | 최초 작성 | Implementer (Sonnet) |
