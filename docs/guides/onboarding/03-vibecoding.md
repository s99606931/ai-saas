# 4장. Claude Code 바이브코딩 (Vibe Coding)

> 공공기관 SaaS 프레임워크 신규 직원 온보딩 가이드북
> 작성일: 2026-04-11 | 버전: 1.0.0
> 대상: 신규 개발자, 기술 PM, 운영 담당자

---

## 목차

1. [Claude Code란?](#1-claude-code란)
2. [설치 및 설정](#2-설치-및-설정)
3. [바이브코딩 철학](#3-바이브코딩-철학)
4. [실전 워크플로우 — PDCA 사이클](#4-실전-워크플로우--pdca-사이클)
5. [주요 슬래시 커맨드 목록](#5-주요-슬래시-커맨드-목록)
6. [에이전트 활용 예시](#6-에이전트-활용-예시)
7. [7단계 Q-Gate 이해](#7-7단계-q-gate-이해)
8. [주의사항 및 제약](#8-주의사항-및-제약)
9. [자주 묻는 질문 (FAQ)](#9-자주-묻는-질문-faq)

---

## 1. Claude Code란?

### 1.1 개념

Claude Code는 Anthropic이 개발한 AI 기반 터미널 개발 보조 도구입니다. 단순한 코드 자동완성 도구가 아니라, 프로젝트 전체 컨텍스트를 이해하고 설계 문서를 읽어 코드를 작성하며 품질 검사까지 수행하는 에이전트형 개발 파트너입니다.

Claude Code는 다음과 같은 특성을 가집니다.

- **200K 토큰 컨텍스트 윈도우**: 대규모 코드베이스 전체를 한 번에 이해합니다.
- **도구 사용 능력**: 파일 읽기/쓰기, bash 명령 실행, 코드 검색 등을 직접 수행합니다.
- **에이전트 위임**: 복잡한 작업을 하위 에이전트에게 위임하여 병렬 처리합니다.
- **프로젝트 하네스 연동**: CLAUDE.md의 규칙을 세션 시작 시 자동으로 내재화합니다.

### 1.2 이 프로젝트에서의 역할

공공기관 SaaS 프레임워크에서 Claude Code는 단독 도구가 아니라 ECC(Everything Claude Code) v1.9.0 하네스와 결합하여 동작합니다. 이 하네스는 CSAP 중/상 등급 인증과 행안부 정보화사업 감리기준 준수를 자동화하기 위해 설계되었습니다.

**Claude Code가 이 프로젝트에서 담당하는 역할:**

| 역할 | 내용 | 담당 에이전트 |
|------|------|--------------|
| 설계 기반 구현 | Plan/Design 문서를 읽고 코드 작성 | Implementer |
| 코드 품질 검사 | OWASP Top10, 102개 정적분석 규칙 | Reviewer |
| 규제 준수 검증 | CSAP 79항목, N2SF 6영역 감사 | Auditor |
| 테스트 작성·실행 | E2E/단위 테스트, 커버리지 80%+ | Tester |
| Dead code 정리 | 구조 개선, 미사용 코드 제거 | Refactorer |
| 프로젝트 총괄 관리 | 35개 MTU PDCA 자율 관리 | PM Lead |

### 1.3 바이브코딩이란?

"바이브코딩(Vibe Coding)"은 개발자가 AI와 협력하여 소프트웨어를 개발하는 방법론입니다. 개발자는 의도와 요구사항을 명확히 제시하고, AI가 코드 생성 및 검증을 담당합니다.

이 프로젝트에서 바이브코딩은 다음 원칙을 따릅니다.

1. **문서 우선**: 코드보다 Plan/Design 문서를 먼저 작성합니다.
2. **에이전트 분업**: 한 에이전트가 모든 것을 하지 않고, 역할별로 전문 에이전트가 처리합니다.
3. **게이트 통과 방식**: 7단계 Q-Gate를 순서대로 통과해야 다음 단계로 진행합니다.
4. **감사 추적**: 모든 AI 작업은 `.claude/audit.jsonl`에 자동 기록됩니다.

---

## 2. 설치 및 설정

### 2.1 Claude Code 설치

Claude Code는 npm 패키지로 제공됩니다. 전역 설치 후 터미널에서 `claude` 명령으로 실행합니다.

```bash
# Node.js 22+ 필수 (프로젝트 표준)
node --version  # v22.x.x 확인

# Claude Code 전역 설치
npm install -g @anthropic-ai/claude-code

# 설치 확인
claude --version
```

> 이 프로젝트는 Node.js 22, pnpm 9.15.0을 표준으로 사용합니다.
> 버전이 다르면 CI/CD 파이프라인과 동작이 달라질 수 있으므로 반드시 맞추어야 합니다.

### 2.2 프로젝트 워크스페이스 연결

```bash
# 프로젝트 디렉토리로 이동
cd /data/ai-saas

# Claude Code 실행 (프로젝트 컨텍스트 자동 로드)
claude

# 또는 특정 작업과 함께 시작
claude "MTU-N252 PDCA 사이클 시작해주세요"
```

Claude Code는 시작 시 다음 파일들을 자동으로 읽어 프로젝트 컨텍스트를 내재화합니다.

- `/data/ai-saas/CLAUDE.md` — 프로젝트 하네스 핵심 규칙
- `/data/ai-saas/.claude/rules/*.md` — 세부 규칙 파일들
- `/data/ai-saas/.claude/settings.json` — 훅 설정 및 권한 목록

### 2.3 CLAUDE.md 이해하기

CLAUDE.md는 이 프로젝트의 "헌법"입니다. Claude Code가 세션 시작 시 반드시 읽어야 하는 절대 규칙이 담겨 있습니다.

**CLAUDE.md의 7개 섹션:**

```
§1. 절대 제약 (Absolute Constraints)     — 어떤 상황에서도 예외 없음
§2. 에이전트 분업 원칙 (Cascade 메서드)  — 5개 에이전트 역할 정의
§3. 문서 형식 기준                       — FR ID 체계, 필수 섹션
§4. Dead Code 정책                       — 미사용 코드 처리 기준
§5. CSAP/N2SF 준수 규칙                  — 보안 코딩 요건
§6. ECC 하네스 통합                      — AgentShield, Q-Gate
§7. 모델 라우팅                          — 비용 최적화 모델 선택
```

신규 직원은 CLAUDE.md 전체를 최소 1회 정독한 후 개발을 시작해야 합니다. 특히 §1 절대 제약은 위반 시 감리 결함으로 처리됩니다.

### 2.4 하네스 훅 동작 이해

프로젝트 `.claude/settings.json`에는 Claude Code의 행동을 제어하는 훅이 설정되어 있습니다.

**PreToolUse 훅 (작업 전 차단):**

| 훅 ID | 감지 패턴 | 처리 |
|-------|----------|------|
| `pre:bash:block-no-verify` | `--no-verify`, `--no-gpg` | 즉시 차단 |
| `pre:bash:destructive-guard` | `rm -rf /`, `DROP TABLE`, `git push --force` | 즉시 차단 |
| `pre:write:protect-secrets` | `.env`, `secrets.*`, `credentials.*` | 즉시 차단 |

**PostToolUse 훅 (작업 후 기록):**

모든 Bash 명령 실행 및 파일 편집 후 `.claude/audit.jsonl`에 타임스탬프와 도구 정보가 자동 기록됩니다. 이는 CSAP D-06 침해사고 관리 요건을 충족하기 위한 것입니다.

**SessionStart 훅:**

세션 시작 시 하네스 제약사항을 자동으로 상기시켜 줍니다.

```
## 하네스 리마인더
- 구현 전 Plan/Design 문서 필수
- Dead code 발견 즉시 제거
- AI API: C/S등급 데이터 전송 금지
- 감사 로그: .claude/audit.jsonl
- 7단계 Q-Gate 순서 준수
```

---

## 3. 바이브코딩 철학

### 3.1 인간-AI 협업 워크플로우

전통적 개발 방식과 바이브코딩 방식의 차이는 다음과 같습니다.

**전통적 방식:**
```
개발자가 요구사항 분석 → 직접 코딩 → 직접 테스트 → 직접 리뷰 요청
```

**바이브코딩 방식 (이 프로젝트):**
```
개발자가 의도 명시 → PM 에이전트가 PDCA 사이클 진행
→ Implementer가 코드 작성 → Reviewer가 품질 검사
→ Auditor가 규제 준수 검증 → Tester가 테스트 실행
→ Refactorer가 Dead code 정리
```

바이브코딩에서 개발자의 역할은 다음과 같이 변화합니다.

- 코드 작성자 → **요구사항 설계자 및 의사결정자**
- 버그 추적자 → **Q-Gate 관리자**
- 코드 리뷰어 → **에이전트 산출물 검토자**
- 문서 작성자 → **Context Anchor 및 FR ID 정의자**

### 3.2 에이전트 역할 분담 (Cascade 메서드)

Cascade 메서드는 작업을 단계별로 전문 에이전트에게 폭포처럼 흘려보내는 방식입니다. 각 에이전트는 자신의 역할만 수행하고, 다음 에이전트에게 파일로 결과물을 전달합니다.

```
사용자 요청
     |
     v
[PM Lead — claude-opus-4-6]
  35개 MTU 관리, PDCA 사이클 자동화
  복잡도 평가 후 팀 구성 결정
     |
     v
[Implementer — claude-sonnet-4-6]
  Plan/Design 문서 기반 코드 작성
  CSAP D-12 보안 코딩 원칙 준수
  산출물: IMPL_COMPLETE.md
     |
     v
[Reviewer — claude-sonnet-4-6]
  102개 정적분석 규칙 검사
  OWASP Top10 취약점 탐지
  산출물: REVIEW_REPORT.md
     |
  BLOCKED? → Implementer 재작업
     |
  APPROVED
     v
[Auditor — claude-opus-4-6]
  CSAP 79항목, N2SF 6영역 검증
  감리 산출물 완전성 확인
  산출물: AUDIT_REPORT.md, COMPLIANCE_MATRIX.md
     |
     v
[Tester — claude-sonnet-4-6]
  TS-1~TS-6 시나리오 테스트
  커버리지 80%+ 확인
  산출물: TEST_RESULT.md
     |
     v
[Refactorer — claude-haiku-4-5]
  Dead code 탐지 및 제거
  코드 구조 개선 (기능 변경 없음)
  산출물: REFACTOR_REPORT.md
```

**에이전트 간 결과물 전달 원칙:**

에이전트들은 직접 컨텍스트를 공유하지 않습니다. 모든 결과물은 파일로 작성되고, 다음 에이전트는 그 파일을 읽어 작업을 시작합니다. 이는 각 단계의 책임을 명확히 하고, 감리 시 증빙 자료로 활용하기 위한 설계입니다.

### 3.3 언제 직접 코딩하고 언제 AI에게 맡길지

| 상황 | 권장 방식 | 이유 |
|------|----------|------|
| CSAP 보안 규칙이 복잡하게 얽힌 신규 기능 | AI 에이전트 위임 | 102개 규칙 자동 적용 |
| 간단한 설정 파일 수정 (1~2줄) | 직접 수정 | 에이전트 호출 오버헤드 불필요 |
| 기존 코드의 버그 수정 | AI 에이전트 위임 | Reviewer가 회귀 버그 방지 |
| 감리 산출물 작성 | AI 에이전트 위임 | 행안부 감리 형식 자동 준수 |
| 아키텍처 결정 | 사람이 직접 판단 | AI는 옵션 제시만, 최종 결정은 사람 |
| 시크릿/자격증명 관련 작업 | 반드시 직접 | AI에게 시크릿 노출 절대 금지 |
| 데이터 분류(C/S 등급) 판정 | 사람이 직접 | N2SF 규정상 사람의 판단 필요 |

---

## 4. 실전 워크플로우 — PDCA 사이클

PDCA(Plan-Do-Check-Act) 사이클은 이 프로젝트의 핵심 개발 방법론입니다. 모든 기능 단위(MTU, Minimum Task Unit)는 이 사이클을 거쳐야 합니다.

### 4.1 PM 에이전트로 PDCA 시작

새로운 기능을 개발하거나 MTU를 진행할 때는 PM Lead 에이전트를 통해 시작합니다.

```bash
# Claude Code 세션 시작
claude

# PM 에이전트 호출 — 전체 상태 파악
> /pm --status

# 특정 MTU 착수
> /pm --mtu MTU-N252

# 팀 구성 요청 (HIGH 복잡도 MTU)
> /pm team MTU-N252
```

PM 에이전트는 세션 시작 시 다음 파일들을 자동으로 읽어 현재 상태를 파악합니다.

- `docs/roadmap/master-roadmap.md` — 전체 35개 MTU + 의존성 그래프
- `.bkit/state/memory.json` — 현재 진행 중인 피처/단계
- `.bkit/state/pdca-status.json` — MTU별 완료 상태
- `docs/archive/**/_INDEX.md` — 완료·아카이브된 MTU 목록

### 4.2 Plan 단계 — 설계 문서 먼저

**절대 원칙: Plan + Design 문서 없이 코드 작성 금지**

이는 CLAUDE.md §1의 절대 제약사항입니다. 문서 없이 구현을 시작하면 감리 결함으로 처리됩니다.

**Plan 문서 위치**: `docs/01-plan/mtus/{mtu-id}.plan.md`

Plan 문서에 포함되어야 하는 필수 섹션:

```markdown
## Executive Summary
| 관점 | 내용 |
|------|------|
| 비즈니스 | WHY — 이 MTU가 필요한 이유 |
| 기능 | WHAT — 구현할 기능 목록 |
| 기술 | HOW — 기술 스택과 접근 방식 |
| 리스크 | RISK — 위험 요소와 대응 방안 |

## Context Anchor
- **WHY**: 이 MTU를 지금 해야 하는 이유
- **WHO**: 영향을 받는 이해관계자
- **RISK**: 주요 위험과 완화 방안
- **SUCCESS**: 성공 기준 (측정 가능)
- **SCOPE**: 포함/제외 범위

## 요구사항 (FR ID 체계)
- FR-{모듈}.{번호}: 기능 요구사항
- NFR-{번호}: 비기능 요구사항
- INFR-{번호}: 인프라 요구사항
```

**Design 문서 위치**: `docs/02-design/mtus/{mtu-id}.design.md`

Design 문서는 아키텍처 결정, API 명세, DB 스키마를 포함해야 합니다. HIGH 복잡도 MTU의 경우 3개 아키텍처 옵션을 제시하고 최적 선택 근거를 기술합니다.

### 4.3 Do 단계 — Implementer 에이전트에게 위임

Plan과 Design 문서가 완성된 후, PM 에이전트가 복잡도를 평가하여 자동으로 라우팅합니다.

| 복잡도 | 조건 | 처리 방식 |
|--------|------|----------|
| LOW | 문서 산출물 1~2개, 코드 구현 없음 | PM이 직접 처리 |
| MED | 산출물 3~4개, 구현 가이드 포함 | Implementer 에이전트 위임 |
| HIGH | 인프라/보안/AI 연동, 산출물 5개+ | CTO Lead 팀 전임 위임 |

Implementer 에이전트가 코드를 작성할 때 지켜야 하는 원칙:

```typescript
// 반드시 포함해야 하는 주석 형식
// Design Ref: §3.2 — API 게이트웨이 패턴 선택 근거
// Plan SC: FR-N252.1 — RCA 자동화 기능

// 입력 검증 필수 (CSAP D-12)
const schema = z.object({
  tenantId: z.string().uuid(),
  dataGrade: z.enum(['C', 'S', 'O']),
})
const validated = schema.parse(requestBody)

// RBAC 검사 필수 (CSAP D-08)
const user = await verifyToken(req.headers.authorization)
if (!hasPermission(user, 'resource:read')) {
  return Response.json({ error: 'Forbidden' }, { status: 403 })
}

// 환경 변수로 시크릿 관리 (하드코딩 절대 금지)
const encryptionKey = process.env.ENCRYPTION_KEY
if (!encryptionKey) throw new Error('ENCRYPTION_KEY 환경 변수 누락')
```

### 4.4 Check 단계 — Q-Gate G1~G7 통과

Do 단계 완료 후 자동으로 Check 단계가 실행됩니다.

**matchRate 기준**: 설계 문서 대비 구현 일치율이 90% 미만이면 PDCA 반복(최대 5회)이 자동 실행됩니다.

**Q-Gate 자동 실행 순서:**

```
G1 (Auditor) → G2 (Auditor) → G3 (Reviewer) → G4 (Tester)
→ G5 (Reviewer) → G6 (Auditor) → G7 (Auditor)
```

G6(CSAP 100%)에서 실패하면 자동 진행이 중단되고 사용자에게 보고합니다. 보안 관련 결정은 사람이 직접 판단해야 합니다.

### 4.5 에이전트 간 결과물 전달 방식

각 에이전트는 작업 완료 후 표준 산출물 파일을 생성합니다.

```
Implementer 완료 → IMPL_COMPLETE.md 생성
                        ↓ (파일 읽기)
Reviewer 실행   → REVIEW_REPORT.md 생성
                        ↓
             BLOCKED? → Implementer에게 반환
             APPROVED? ↓
Auditor 실행    → AUDIT_REPORT.md + COMPLIANCE_MATRIX.md 생성
                        ↓
Tester 실행     → TEST_RESULT.md 생성
                        ↓
Refactorer 실행 → REFACTOR_REPORT.md 생성
                        ↓
PM Lead 아카이브 → docs/archive/YYYY-MM/{mtu-id}/
                   .bkit/state/pdca-status.json 업데이트
```

---

## 5. 주요 슬래시 커맨드 목록

### 5.1 PM 관련 커맨드

**`/pm team`** — PM 팀 구성

HIGH 복잡도 MTU에 대해 CTO Lead 팀을 자동 구성합니다. Implementer, Reviewer, Tester로 구성된 팀이 병렬로 작업합니다.

```bash
# 사용 예시
> /pm team MTU-I1
# → CTO Lead 에이전트가 자동 호출되어 팀 구성
# → 인프라 클러스터(MTU-I1~I4) 관련 전문 팀 편성
```

**`/pm --status`** — 프로젝트 전체 상태 확인

현재 진행 중인 MTU, 완료된 MTU, 의존성 블로커를 한눈에 파악합니다.

```bash
> /pm --status
# 출력 예시:
# 완료 MTU:   15 / 35
# 진행 중:    MTU-N252 @ do-phase
# 착수 가능:  MTU-N253, MTU-N254 (의존 없음)
# 다음 착수 권장: MTU-N253 (CSAP 증거 수집 자동화)
```

**`/pm --mtu MTU-ID`** — 특정 MTU 상세 진행

지정된 MTU의 PDCA 사이클을 처음부터 진행하거나 현재 단계부터 재개합니다.

```bash
> /pm --mtu MTU-N252
# → Plan 문서 존재 여부 확인
# → Design 문서 존재 여부 확인
# → 복잡도 평가 후 적절한 에이전트 호출
```

### 5.2 PDCA 관련 커맨드

**`/bkit:pdca`** — PDCA 사이클 전체 자동 실행

현재 활성 MTU에 대해 Plan → Do → Check → Act 사이클 전체를 자동 실행합니다.

```bash
> /bkit:pdca
# → .bkit/state/memory.json에서 현재 MTU 확인
# → 각 단계별 에이전트 순차 호출
# → 최종 아카이브까지 자동 완료
```

### 5.3 코드 품질 관련 커맨드

**`/simplify`** — 코드 품질 개선

복잡한 함수를 단순화하고, 80줄 이상 함수를 분리하며, 중복 코드를 함수화합니다. Refactorer 에이전트가 실행됩니다.

```bash
> /simplify platform/services/ai-service/src/lib/rag-engine.ts
# → Refactorer 에이전트 실행
# → 함수 크기, 중첩 깊이, 중복 코드 분석
# → 기능 변경 없이 구조만 개선
```

**`/review`** — 코드 리뷰 요청

Reviewer 에이전트가 OWASP Top10과 102개 정적분석 규칙으로 코드를 검사합니다.

```bash
> /review platform/services/auth-service/src/
# → Reviewer 에이전트 실행
# → REVIEW_REPORT.md 생성
# → CRITICAL/HIGH 이슈 발견 시 BLOCKED 처리
```

**`/qa`** — 품질 검사 실행

Q-Gate G1~G7 전체를 순서대로 실행합니다. CI/CD 파이프라인과 동일한 품질 기준을 로컬에서 미리 확인할 수 있습니다.

```bash
> /qa
# → G1: FR ID 전수 확인
# → G3: npm run lint + typecheck
# → G4: npm run test:coverage
# → G5: 하드코딩 시크릿, SQL 직접 결합 검사
# → G7: .claude/audit.jsonl 완비 확인
```

### 5.4 배포 관련 커맨드

**`/ship`** — 배포 준비

현재 브랜치의 변경사항이 모든 Q-Gate를 통과했는지 확인하고 PR 생성을 안내합니다.

```bash
> /ship
# → Q-Gate 최종 확인
# → CHANGELOG.md 업데이트 확인
# → PR 템플릿 생성 안내
# → stg → main PR 생성 안내
```

### 5.5 루프 및 자동화 커맨드

**`/loop 7d npm run audit:dead-code`** — 주간 Dead code 자동 탐지

Dead code 탐지 도구(ts-prune, depcheck)를 주간 주기로 자동 실행합니다.

**`/loop 2m npm test`** — 반복 테스트 실행

지정된 시간 동안 테스트를 주기적으로 실행합니다. 구현 중 테스트 모니터링에 활용합니다.

**`/compact`** — 컨텍스트 압축

대화가 길어져 컨텍스트 50% 임계값에 도달했을 때 수동으로 압축합니다. 논리적 전환점(한 에이전트 완료 후)에 사용하기 좋습니다.

---

## 6. 에이전트 활용 예시

### 6.1 신규 서비스 추가 시나리오

**상황**: AI AIOps RCA(Root Cause Analysis) 자동화 서비스를 새로 추가해야 합니다.

**단계 1 — PM 에이전트로 MTU 착수:**

```bash
> /pm --mtu MTU-N252
```

PM 에이전트가 자동으로 수행하는 작업:
1. 웹검색으로 AIOps RCA 관련 최신 기술 정보 수집
2. `docs/01-plan/mtus/MTU-N252.plan.md` 생성 (FR ID 포함)
3. `docs/02-design/mtus/MTU-N252.design.md` 생성 (3개 아키텍처 옵션 → 최적 선택)
4. 복잡도 평가: HIGH → CTO Lead 팀 구성

**단계 2 — Implementer가 코드 작성:**

Implementer 에이전트가 자동으로 수행하는 작업:
1. Design 문서의 API 명세 확인
2. RBAC, 입력 검증, 암호화 코드 포함하여 구현
3. `// Design Ref: §3.2`, `// Plan SC: FR-N252.1` 주석 삽입
4. `IMPL_COMPLETE.md` 생성 후 Reviewer에게 인계

**단계 3 — Reviewer가 품질 검사:**

```
검사 결과: REVIEW_REPORT.md
- A01 접근 제어: RBAC 누락 없음 [OK]
- A03 주입 공격: 매개변수화 쿼리 사용 [OK]
- A09 보안 로깅: auditLog() 호출 확인 [OK]
최종: APPROVED → Auditor 인계
```

**단계 4 — Auditor가 CSAP 검증:**

```
검증 결과: AUDIT_REPORT.md
- G1 FR ID 전수: FR-N252.1~N252.5 모두 구현 확인 [OK]
- G6 CSAP D-12: 입력 검증, SQL 주입 방지 [OK]
- G7 감사 로그: audit.jsonl 기록 확인 [OK]
최종 판정: PASSED
```

**단계 5 — Tester가 테스트 실행:**

```bash
# Tester 에이전트가 자동 생성하는 테스트
npx playwright test tests/e2e/aiops-rca.spec.ts
# 커버리지: 신규 코드 83% (목표 80% 충족)
```

**단계 6 — Refactorer가 정리:**

```bash
npx ts-prune --error
# Dead code 발견 없음
# REFACTOR_REPORT.md: Dead code 0개 달성
```

**단계 7 — PM이 아카이브:**

```
docs/archive/2026-04/MTU-N252/
├── MTU-N252.plan.md
├── MTU-N252.design.md
├── MTU-N252.analysis.md
└── MTU-N252.report.md
.bkit/state/pdca-status.json 업데이트
```

### 6.2 버그 수정 시나리오

**상황**: AI 서비스에서 N2SF O등급 데이터에 PII 마스킹이 적용되지 않는 버그가 발견되었습니다.

```bash
# 브랜치 생성
git checkout -b fix/n2sf-pii-masking-missing

# 버그 수정 작업 요청
> AI 서비스에서 O등급 데이터 전송 전 PII 마스킹이 빠졌습니다.
  platform/services/ai-service/src/lib/rag-engine.ts를 수정해주세요.
```

Implementer 에이전트가 다음을 수행합니다:
1. `rag-engine.ts` 파일 읽기
2. `security-gateway-pattern.md` 참조하여 올바른 패턴 확인
3. `maskPII()` 함수 호출 추가
4. `// Design Ref: §AI-REQ-2 — PII 마스킹 필수` 주석 삽입

```typescript
// 수정 전 (버그)
async function sendToAI(data: ProcessedData): Promise<AIResponse> {
  return aiGateway.send(data)  // PII 마스킹 누락!
}

// 수정 후 (올바른 패턴)
// Design Ref: §AI-REQ-2 — N2SF N-05 PII 마스킹 필수
async function sendToAI(data: ProcessedData, grade: DataGrade): Promise<AIResponse> {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
  const masked = await maskPII(data)
  return aiGateway.send(masked)
}
```

Reviewer가 자동으로 수정 내용을 검증한 후 APPROVED 처리합니다.

```bash
# 커밋 (--no-verify 절대 사용 금지)
git add platform/services/ai-service/src/lib/rag-engine.ts
git commit -m "fix(n2sf): O등급 데이터 PII 마스킹 누락 수정 (N2SF N-05)"
```

### 6.3 문서 작성 시나리오

**상황**: MTU-N253 CSAP 증거 수집 자동화의 Plan 문서를 작성해야 합니다.

```bash
> MTU-N253 CSAP 증거 수집 자동화에 대한 Plan 문서를 작성해주세요.
  행안부 감리기준 형식으로 FR ID를 포함해야 합니다.
```

PM 에이전트가 자동으로 수행하는 작업:
1. 웹검색: "CSAP 표준등급 2026 증거 수집 자동화"
2. `docs/01-plan/mtus/MTU-N253.plan.md` 생성
3. 필수 섹션 포함: Executive Summary, Context Anchor, FR ID 체계, 추적성 매트릭스
4. CSAP D-01~D-13 매핑 테이블 포함

---

## 7. 7단계 Q-Gate 이해

Q-Gate는 코드가 메인 브랜치에 병합되기 전에 반드시 통과해야 하는 7단계 품질 검사 관문입니다. `.gitea/workflows/quality-gate.yml`에 CI/CD 파이프라인으로 자동화되어 있습니다.

### G1: 요구사항 FR ID 전수 (Auditor 담당)

**목적**: 구현된 코드에 대응하는 FR ID가 Plan 문서에 정의되어 있는지 확인합니다.

**검사 내용:**
- Plan 문서(`docs/01-plan/mtus/*.plan.md`)에 FR ID가 1개 이상 정의되어 있는지
- 요구사항 → 산출물 매핑이 존재하는지
- 추적성 매트릭스(T07)가 최신화되어 있는지

**실패 시 조치**: FR ID가 없는 Plan 문서를 보완하거나, 구현된 기능에 해당하는 Plan 문서를 먼저 작성합니다.

```bash
# G1 로컬 확인
grep -roh 'FR-[A-Z0-9]*\.[0-9]*' docs/01-plan/mtus/*.plan.md | sort -u | wc -l
# 0이면 G1 실패
```

### G2: 설계 완전성 (Auditor 담당)

**목적**: Design 문서가 구현에 충분한 정보를 제공하는지 확인합니다.

**검사 내용:**
- Design 문서 필수 11개 섹션 완비 여부
- 아키텍처 다이어그램, API 명세, DB 스키마 포함 여부
- Context Anchor 표(WHY/WHO/RISK/SUCCESS/SCOPE) 존재 여부

**실패 시 조치**: Design 문서의 누락된 섹션을 보완합니다. 특히 API 명세와 DB 스키마는 구현 전에 반드시 확정되어야 합니다.

### G3: 코드 품질 + AgentShield 102규칙 (Reviewer 담당)

**목적**: 코드가 프로젝트 표준과 보안 규칙을 준수하는지 확인합니다.

**검사 내용:**
- `pnpm run lint` — ESLint + Prettier 규칙 준수
- `pnpm run typecheck` — TypeScript 타입 오류 없음
- AgentShield 102개 정적분석 규칙 통과

**주요 AgentShield 규칙:**

| 규칙 분류 | 검사 항목 |
|----------|----------|
| 보안 | 하드코딩 시크릿, 인증 누락 API, SQL 직접 결합 |
| 품질 | 함수 크기 80줄 초과, 중첩 4단계 초과 |
| Dead code | 미사용 export, 미사용 import |
| 문서 | Design Ref 주석 누락 |

**실패 시 조치**: 린트 오류와 타입 오류를 수정합니다. CRITICAL/HIGH 이슈는 반드시 해결해야 하고, MEDIUM 이하는 선택 사항입니다.

```bash
# G3 로컬 확인
pnpm run lint
pnpm run typecheck
```

### G4: 테스트 커버리지 80%+ (Tester 담당)

**목적**: 신규 코드에 대한 충분한 테스트가 작성되었는지 확인합니다.

**커버리지 기준:**

| 대상 | 최소 커버리지 |
|------|------------|
| 신규 함수 전체 | 80% |
| 변경된 코드 경로 | 90% |
| CSAP 관련 로직 | 100% |
| AI 게이트웨이 (C/S 등급 차단) | 100% |

CSAP 관련 로직과 AI 게이트웨이는 감리 대응을 위해 100% 커버리지가 필수입니다.

```bash
# G4 로컬 확인
pnpm run test -- --coverage
# coverage/coverage-summary.json에서 lines.pct 확인
```

### G5: OWASP Top10 통과 (Reviewer 담당)

**목적**: 주요 웹 보안 취약점이 없는지 확인합니다.

**10개 검사 항목:**

| 코드 | 취약점 | 검사 방식 |
|------|--------|----------|
| A01 | 접근 제어 취약 | RBAC 누락 API 탐지 |
| A02 | 암호화 실패 | 평문 저장·전송 패턴 탐지 |
| A03 | 주입 공격 | SQL/Command 직접 결합 탐지 |
| A04 | 안전하지 않은 설계 | Zod 스키마 입력 검증 누락 탐지 |
| A05 | 보안 설정 오류 | 하드코딩 자격증명, 디버그 모드 탐지 |
| A06 | 취약·구식 컴포넌트 | npm audit CRITICAL 취약점 |
| A07 | 인증·세션 관리 실패 | JWT 검증 누락 탐지 |
| A08 | 데이터 무결성 실패 | 안전하지 않은 역직렬화 탐지 |
| A09 | 보안 로깅·모니터링 실패 | auditLog() 호출 누락 탐지 |
| A10 | SSRF | 외부 URL 직접 호출 탐지 |

**CI/CD 자동 검사 예시:**

```yaml
# .gitea/workflows/quality-gate.yml — G5 OWASP 검사
- name: Secret Detection
  run: |
    if grep -rn --include="*.ts" -E "sk-[a-zA-Z0-9]{20,}" platform/; then
      echo "[CRITICAL] 하드코딩 API 키 발견"
      exit 1
    fi

- name: SQL Injection Pattern Check
  run: |
    if grep -rn --include="*.ts" \
      -E "SELECT.*FROM.*\$\{|INSERT.*INTO.*\$\{" platform/services/; then
      echo "[WARN] SQL 직접 결합 패턴 의심"
    fi
```

### G6: CSAP 해당 Phase 100% (Auditor 담당)

**목적**: CSAP 인증을 위한 보안 통제항목이 해당 Phase에서 모두 충족되는지 확인합니다.

**Phase별 검증 범위:**

| Phase | 검증 CSAP 분야 | 항목 수 |
|-------|--------------|--------|
| 1 | D-08(접근통제 일부), D-09(암호화), D-12(개발보안) | 26개 |
| 2 | D-01~D-13 전체 | 79개 |
| 3 | 상등급 추가 요건 | 추가 요건 |

**이 게이트가 유일하게 자동 진행을 중단하는 관문입니다.** G6 실패 시 PM 에이전트는 사용자에게 보고하고 대기합니다. 보안 통제항목 관련 결정은 반드시 사람이 직접 판단해야 합니다.

**준수 상태 표기:**

| 표기 | 의미 | 처리 |
|------|------|------|
| OK 충족 | 산출물 또는 코드에 명시적 구현 확인 | 통과 |
| 경고 부분 | 일부 구현, 보완 필요 | 보완 후 재검증 |
| 실패 미충족 | 산출물/코드 없음 | 즉시 플래그, 진행 중단 |

### G7: 감사 추적 audit.jsonl 완비 (Auditor 담당)

**목적**: 모든 민감 작업이 감사 로그에 기록되어 있는지 확인합니다.

**검사 내용:**
- `.claude/audit.jsonl` 파일 존재 여부
- 세션 시작·종료 기록 완비
- 민감 작업(파일 수정, Bash 실행) 전수 기록

```bash
# G7 로컬 확인
ls -la .claude/audit.jsonl
tail -10 .claude/audit.jsonl | jq '.'
```

**감사 로그 형식 예시:**

```json
{"timestamp":"2026-04-11T09:00:00Z","tool":"Bash","user":"developer"}
{"timestamp":"2026-04-11T09:01:23Z","tool":"Edit/Write","user":"developer"}
{"timestamp":"2026-04-11T10:30:00Z","event":"session-end"}
```

이 로그는 CSAP D-06 침해사고 관리 요건을 충족하기 위한 것으로, append-only 구조로 수정 및 삭제가 불가능합니다. 최소 1년간 보존해야 합니다.

---

## 8. 주의사항 및 제약

### 8.1 N2SF 데이터 등급과 AI API 사용 규칙

이 프로젝트에서 AI API를 사용할 때 가장 중요한 규칙입니다. N2SF(National Network Security Framework) 규정에 따라 데이터 등급별로 AI API 사용이 제한됩니다.

**데이터 등급 분류:**

| 등급 | 정의 | AI API 전송 |
|------|------|------------|
| C (기밀) | 공개 시 국가 안보, 국민 생활에 심각한 영향 | 절대 금지 |
| S (민감) | 공개 시 개인 프라이버시, 업무 수행에 부정적 영향 | 절대 금지 |
| O (공개) | 공개되어도 무방한 정보 | PII 마스킹 후 허용 |

**올바른 AI API 호출 패턴:**

```typescript
// Design Ref: §06-ai-integration/security-gateway-pattern.md
// Plan SC: AI-REQ-1 — N2SF N-05 데이터 등급 통제

enum DataGrade { C = 'C', S = 'S', O = 'O' }

async function sendToAI(data: unknown, grade: DataGrade): Promise<AIResponse> {
  // C, S 등급: 즉시 차단
  if (grade === DataGrade.C || grade === DataGrade.S) {
    await auditLog({ action: 'AI_API_BLOCKED', grade, reason: 'N2SF N-05' })
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }

  // O 등급: PII 마스킹 후 AI Gateway 경유
  const masked = await maskPII(data)
  return aiGateway.send(masked)  // 직접 외부 AI API 호출 금지
}
```

**절대 금지 사항:**
- 직접 외부 AI API(Anthropic, OpenAI 등) 호출 금지
- AI Gateway를 우회한 데이터 전송 금지
- C/S 등급 데이터가 포함된 프롬프트 작성 금지

### 8.2 git 훅 우회 금지

```bash
# 절대 사용 금지
git commit --no-verify  # ECC block-no-verify 훅이 차단
git push --force        # destructive-guard 훅이 차단
git push -f             # destructive-guard 훅이 차단
```

git 훅이 실패하는 경우, 훅을 우회하지 말고 훅이 실패하는 근본 원인을 찾아 해결해야 합니다. 훅 우회는 감사 추적 파괴로 간주되며 CSAP D-06 위반입니다.

**훅 실패 시 올바른 대응:**

```bash
# 1. 훅 실패 메시지 확인
git commit -m "feat: 새 기능"
# 오류: 린트 실패

# 2. 오류 원인 수정
pnpm run lint --fix

# 3. 수정 후 재커밋 (--no-verify 사용 금지)
git add -p
git commit -m "feat: 새 기능"
```

### 8.3 CLAUDE.md 절대 제약 목록

다음은 CLAUDE.md §1에 정의된 절대 제약입니다. 예외 없이 적용됩니다.

| 제약 | 내용 | 위반 시 결과 |
|------|------|------------|
| 문서 우선 | Plan + Design 없이 구현 착수 금지 | 감리 결함 |
| 시크릿 커밋 금지 | `.env`, `secrets.*`, `*credential*` 커밋 금지 | 즉시 차단 (훅) |
| 파괴적 명령 금지 | `git push --force`, `rm -rf /*`, `DROP TABLE`, `DELETE FROM`(WHERE 없음) | 즉시 차단 (훅) |
| 외부 서비스 금지 | AI/LLM API 외 외부 클라우드 서비스 사용 금지 | 감리 지적 |
| AI 데이터 등급 | C/S 등급 데이터 AI API 전송 절대 금지 | CSAP/N2SF 위반 |
| git 훅 우회 금지 | `--no-verify`, `--no-gpg` 사용 금지 | 즉시 차단 (훅) |
| 한국어 문서 | 모든 문서는 한국어, 공공기관 표준 용어 사용 | 감리 지적 |

### 8.4 시크릿 및 자격증명 관리

```bash
# 절대 금지: 코드에 직접 기입
const API_KEY = 'sk-1234567890'  # BLOCKED

# 올바른 방법: 환경 변수 사용
const API_KEY = process.env.AI_API_KEY
if (!API_KEY) {
  throw new Error('AI_API_KEY 환경 변수 누락')
}
```

환경 변수 예시 파일은 `docs/env.example`을 참고합니다. 실제 값이 들어간 `.env` 파일은 `.gitignore`에 의해 커밋이 차단되며, 추가로 훅(`pre:write:protect-secrets`)이 이중으로 보호합니다.

---

## 9. 자주 묻는 질문 (FAQ)

### Q1. 에이전트가 틀린 코드를 생성하면 어떻게 됩니까?

**A.** Reviewer 에이전트가 잡아줍니다. Implementer가 코드를 작성하면 자동으로 Reviewer가 호출되어 OWASP Top10과 102개 정적분석 규칙으로 검사합니다. CRITICAL 또는 HIGH 이슈가 발견되면 BLOCKED 처리되어 Implementer에게 반환됩니다. 이 과정이 자동으로 반복되므로 결함이 있는 코드가 main 브랜치에 병합되기 어렵습니다.

추가로 Auditor 에이전트가 CSAP 79항목으로 이중 검증하고, CI/CD의 Q-Gate가 세 번째 방어선 역할을 합니다.

### Q2. Plan/Design 문서 없이 바로 구현하면 어떻게 됩니까?

**A.** 감리 결함으로 처리됩니다. CLAUDE.md §1에 명시된 절대 제약으로, PM 에이전트가 Plan 문서 없이 Do 단계를 시작하지 않도록 설계되어 있습니다. 직접 Implementer를 호출하더라도 에이전트 프롬프트에 "Design 문서 전체 읽기 필수"가 명시되어 있어, 문서가 없으면 에이전트가 작업을 거부합니다.

행안부 정보시스템 감리기준에서 문서 없는 구현은 치명적인 결함으로 간주되므로, 이 원칙은 절대 예외를 두지 않습니다.

### Q3. Q-Gate가 너무 엄격해서 개발 속도가 느려지지 않습니까?

**A.** 단기적으로는 느릴 수 있지만, 장기적으로는 더 빠릅니다. CSAP 감리를 통과하기 위해서는 어차피 모든 보안 항목을 충족해야 합니다. Q-Gate는 이를 개발 중에 자동으로 확인하여 감리 직전에 대규모 수정이 발생하는 상황을 방지합니다.

또한 Q-Gate G1~G7 중 G6(CSAP 100%)을 제외한 나머지는 자동화되어 있어 개발자가 직접 확인하는 시간이 거의 들지 않습니다.

### Q4. Auditor 에이전트가 Opus 모델을 사용하는데, 비용이 많이 들지 않습니까?

**A.** 모델 라우팅 정책(CLAUDE.md §7)에 따라 역할에 맞는 모델을 사용하도록 최적화되어 있습니다. Auditor만 Opus를 사용하고, 구현·리뷰·테스트는 Sonnet, 리팩토링 탐색은 Haiku를 사용합니다. 복합 규제 분석이 필요한 Auditor에게만 Opus를 투자하여 비용 대비 효과를 극대화합니다.

### Q5. N2SF 데이터 등급을 판단하기 어렵습니다. 기준이 있습니까?

**A.** `docs/framework/n2sf-grade-guide.md`에 판단 기준이 상세히 설명되어 있습니다. 판단이 어려운 경우에는 더 높은 등급(C 또는 S)으로 분류하는 것이 안전합니다. 데이터 등급 판정은 사람이 직접 해야 하며 AI에게 맡길 수 없습니다. 불명확한 경우 보안 담당자에게 확인합니다.

간단한 기준:
- 개인정보(이름, 연락처, 주민번호 포함) → S 등급 이상
- 시스템 내부 설정값, 운영 데이터 → S 등급 이상
- 공개된 정책 문서, 일반 가이드라인 → O 등급

### Q6. 에이전트가 실수로 .env 파일을 수정하려 하면 어떻게 됩니까?

**A.** `pre:write:protect-secrets` 훅이 즉시 차단합니다. `.claude/settings.json`의 PreToolUse 훅이 `.env`, `secrets.*`, `credentials.*` 패턴을 감지하면 작업을 자동 차단하고 감사 로그에 기록합니다. Claude Code가 이 훅을 우회하는 것은 기술적으로 불가능하도록 설계되어 있습니다.

### Q7. 세션 중간에 컨텍스트가 너무 길어지면 어떻게 합니까?

**A.** `/compact` 명령을 사용합니다. CLAUDE.md §7에 명시된 것처럼 컨텍스트 50% 임계값에서 자동 압축이 발생합니다. 하지만 자동 압축보다는 논리적 전환점(한 에이전트 완료 후, 한 MTU 완료 후)에 수동으로 `/compact`를 실행하는 것이 권장됩니다. 이렇게 하면 중요한 컨텍스트가 보존됩니다.

### Q8. 로컬에서 테스트 환경을 구성하기 어렵습니다. 어떻게 합니까?

**A.** `.gitea/workflows/quality-gate.yml`을 보면 테스트 환경에서 PostgreSQL 16과 Redis 7을 사용합니다. 로컬에서는 Docker Compose를 사용하여 동일한 환경을 구성할 수 있습니다.

```bash
# 테스트 데이터베이스 실행
docker run -d \
  -e POSTGRES_USER=saas \
  -e POSTGRES_PASSWORD=saas_test_2026 \
  -e POSTGRES_DB=saas_platform_test \
  -p 5432:5432 \
  postgres:16-alpine

docker run -d -p 6379:6379 redis:7-alpine

# 환경 변수 설정 (실제 값은 팀에서 별도 공유)
export DATABASE_URL=postgresql://saas:saas_test_2026@localhost:5432/saas_platform_test
export REDIS_URL=redis://localhost:6379
export JWT_SECRET=local-dev-secret

# 테스트 실행
pnpm run test
```

### Q9. 감사 로그 audit.jsonl이 너무 커지면 어떻게 합니까?

**A.** CSAP D-06 요건에 따라 최소 1년간 보존해야 합니다. 파일 크기가 우려될 경우 월별 아카이브 스크립트를 사용합니다. 단, 보존 기간 내 데이터를 삭제하거나 수정하는 것은 CSAP 위반이므로, 아카이브 후에도 원본 데이터를 유지해야 합니다.

### Q10. CI/CD 파이프라인이 self-hosted 러너를 사용하는데, 러너 설정은 어떻게 합니까?

**A.** `docs/07-infra/` 디렉토리에 k3s WSL2 환경 설정 가이드가 있습니다. self-hosted 러너는 보안 정책상 외부 클라우드 CI/CD 서비스(GitHub Actions 무료 러너 등)를 사용할 수 없는 공공기관 환경을 위한 설정입니다. 인프라 설정에 어려움이 있으면 MTU-I1~I4 문서를 참고하거나 인프라 담당자에게 문의합니다.

---

## 부록 A. 에이전트 파일 위치 참조

| 에이전트 | 파일 경로 | 모델 |
|---------|----------|------|
| PM Lead | `/data/ai-saas/.claude/agents/pm-lead.md` | claude-opus-4-6 |
| Implementer | `/data/ai-saas/.claude/agents/implementer.md` | claude-sonnet-4-6 |
| Reviewer | `/data/ai-saas/.claude/agents/reviewer.md` | claude-sonnet-4-6 |
| Auditor | `/data/ai-saas/.claude/agents/auditor.md` | claude-opus-4-6 |
| Tester | `/data/ai-saas/.claude/agents/tester.md` | claude-sonnet-4-6 |
| Refactorer | `/data/ai-saas/.claude/agents/refactorer.md` | claude-haiku-4-5 |

## 부록 B. 규칙 파일 위치 참조

| 규칙 | 파일 경로 |
|------|----------|
| 프로젝트 하네스 | `/data/ai-saas/CLAUDE.md` |
| CSAP/N2SF 준수 | `/data/ai-saas/.claude/rules/csap-compliance.md` |
| Dead code 정책 | `/data/ai-saas/.claude/rules/deadcode-policy.md` |
| 하네스 제약 | `/data/ai-saas/.claude/rules/harness-constraints.md` |
| 훅 및 권한 설정 | `/data/ai-saas/.claude/settings.json` |

## 부록 C. 주요 문서 경로

| 문서 | 경로 |
|------|------|
| 전체 로드맵 | `docs/roadmap/master-roadmap.md` |
| MTU Plan 문서 | `docs/01-plan/mtus/{mtu-id}.plan.md` |
| MTU Design 문서 | `docs/02-design/mtus/{mtu-id}.design.md` |
| 완료 아카이브 | `docs/archive/YYYY-MM/{mtu-id}/` |
| PDCA 상태 | `.bkit/state/pdca-status.json` |
| 감사 로그 | `.claude/audit.jsonl` |
| CI/CD 품질 게이트 | `.gitea/workflows/quality-gate.yml` |

---

*이 가이드에 대한 질문이나 개선 제안은 팀 내 기술 PM에게 문의하십시오.*
*문서 버전 관리: 변경 시 CLAUDE.md 형식에 따라 변경 이력을 기록합니다.*
