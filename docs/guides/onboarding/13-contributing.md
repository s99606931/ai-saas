# 기여 가이드 — 공공기관 SaaS 프레임워크

> **문서 ID**: ONBOARD-13
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **학습 대상**: 코드 기여를 시작하는 모든 팀원
> **선행 문서**: `00-project-history.md`, `07-security-compliance.md`
> **예상 소요 시간**: 1시간 (숙지)

---

## 목차

1. [기여 방법 개요](#1-기여-방법-개요)
2. [Git 워크플로우 단계별 가이드](#2-git-워크플로우-단계별-가이드)
3. [PR 설명 작성 가이드](#3-pr-설명-작성-가이드)
4. [코드 리뷰 에티켓](#4-코드-리뷰-에티켓)
5. [CLAUDE.md 절대 제약 요약](#5-claudemd-절대-제약-요약)
6. [자주 하는 실수 TOP 10](#6-자주-하는-실수-top-10)
7. [긴급 상황 Hotfix 절차](#7-긴급-상황-hotfix-절차)
8. [신규 서비스 추가하는 방법](#8-신규-서비스-추가하는-방법)
9. [신규 패키지 추가하는 방법](#9-신규-패키지-추가하는-방법)
10. [기여 전체 흐름 다이어그램](#10-기여-전체-흐름-다이어그램)
11. [PR → Q-Gate → 머지 시퀀스](#11-pr--q-gate--머지-시퀀스)
12. [변경 이력](#12-변경-이력)

---

## 1. 기여 방법 개요

이 프로젝트에 기여하는 방법은 세 가지입니다.

### 1.1 신규 기능 개발

신규 기능은 반드시 **Plan 문서 → Design 문서 → 구현** 순서를 지켜야 합니다. 문서 없는 구현은 감리 결함으로 간주됩니다.

```
절차:
  1. Gitea에서 Feature Request Issue 생성
  2. MTU Plan 문서 작성 (docs/01-plan/mtus/)
  3. Design 문서 작성
  4. feat/ 브랜치에서 구현
  5. Q-Gate 통과 확인
  6. PR 제출 → 리뷰 → 머지
```

### 1.2 버그 수정

버그 수정은 Plan 문서를 생략할 수 있으나, 반드시 Issue를 먼저 생성하고 영향 분석을 기록해야 합니다.

```
절차:
  1. Gitea에서 Bug Report Issue 생성 (재현 방법, 영향 범위 포함)
  2. fix/ 브랜치에서 수정
  3. 회귀 테스트 추가 (반드시)
  4. PR 제출 → 리뷰 → 머지
```

### 1.3 문서 개선

문서 수정은 코드 변경보다 절차가 간소합니다. 단, 규정/인증 관련 문서는 Auditor 에이전트 검토가 필요합니다.

```
절차:
  1. docs/ 브랜치에서 직접 수정
  2. PR 제출 → 간략 리뷰 → 머지
  (CSAP/N2SF 관련 문서는 Auditor 검토 필수)
```

---

## 2. Git 워크플로우 단계별 가이드

### Step 1: Gitea에서 Issue 생성

모든 작업은 Gitea Issue에서 시작합니다. Issue 없이 브랜치를 만들고 PR을 올리는 것은 금지입니다.

**Feature Issue 작성 양식**:

```markdown
## 기능 요약
[한 문장으로 기능 설명]

## 배경 및 필요성
[왜 이 기능이 필요한지]

## 관련 요구사항 ID
- FR-X.X: [기능 요구사항]
- NFR-X: [비기능 요구사항]

## CSAP 관련 통제항목
- D-XX: [해당 항목]

## 예상 작업 범위
- [ ] 서비스: [서비스명]
- [ ] 영향 패키지: [패키지명]
- [ ] 예상 소요: [일수]
```

**Issue 번호 기억**: PR 제목에 `#이슈번호`를 반드시 포함합니다.

---

### Step 2: 브랜치 생성

브랜치 이름은 접두사 + 이슈번호 + 간략한 설명 형식을 따릅니다.

```bash
# 현재 main 브랜치에서 최신 상태를 가져옵니다
git checkout main
git pull origin main

# stg 브랜치도 최신으로 유지
git checkout stg
git pull origin stg

# 작업 브랜치 생성 (stg 기반)
git checkout stg
git checkout -b feat/N253-csap-evidence-v2

# 브랜치 이름 규칙:
# feat/   — 신규 기능
# fix/    — 버그 수정
# docs/   — 문서 개선
# refactor/ — 리팩토링 (기능 변경 없음)
# test/   — 테스트 추가
# chore/  — 빌드/설정 변경
```

**중요**: 브랜치는 항상 `stg`에서 생성합니다. `main`에서 직접 브랜치를 생성하지 마십시오.

---

### Step 3: 코드 작성 (CLAUDE.md 규칙 준수)

코드를 작성하기 전에 다음 체크리스트를 확인합니다.

```
사전 확인 체크리스트:
  □ Plan 문서가 존재하는가? (신규 기능인 경우)
  □ Design 문서가 존재하는가? (신규 기능인 경우)
  □ 하드코딩된 시크릿이 없는가?
  □ 모든 API 엔드포인트에 RBAC 검사가 있는가?
  □ 민감 작업에 auditLog() 호출이 있는가?
  □ 입력 검증이 Zod 스키마로 되어 있는가?
  □ SQL 쿼리에 매개변수화가 적용되어 있는가?
```

**Claude Code를 활용하는 경우**:

```bash
# 프로젝트 루트에서 Claude Code 실행
cd /data/ai-saas
claude

# Implementer 에이전트 호출
# Claude Code가 CLAUDE.md를 자동으로 읽고 규칙을 준수합니다
```

**코딩 스타일 준수**:

```typescript
// 좋은 예: 명확한 이름, 단일 책임, 감사 로그 포함
async function deactivateTenantAccount(
  adminUser: AuthenticatedUser,
  tenantId: string,
  reason: string
): Promise<void> {
  await auditLog({
    actor: adminUser.id,
    action: 'TENANT_DEACTIVATE',
    target: tenantId,
    metadata: { reason },
    timestamp: new Date().toISOString(),
  })

  await tenantRepository.deactivate(tenantId, reason)
}

// 나쁜 예: 모호한 이름, 감사 로그 없음
async function doThing(id: string) {
  await db.update('tenants', { active: false }, { id })
}
```

---

### Step 4: 로컬 테스트

PR을 올리기 전에 반드시 로컬에서 테스트를 실행합니다.

```bash
# 전체 테스트 실행 (커버리지 포함)
pnpm test:coverage

# 특정 서비스만 테스트
pnpm --filter @public-saas/ai-service test:coverage

# 타입 검사
pnpm typecheck

# 린트 검사
pnpm lint

# 빌드 확인
pnpm build

# 커버리지 목표: 80% 이상 (Q-Gate G4)
# 빌드 실패: PR 올리기 전 반드시 수정
```

**테스트 커버리지가 80% 미만인 경우**:

```bash
# 커버리지 리포트로 미커버 영역 확인
pnpm --filter @public-saas/[서비스명] test:coverage --reporter=lcov
# coverage/lcov-report/index.html 열어서 확인

# 미커버 라인에 집중하여 테스트 추가
```

---

### Step 5: 커밋 (Conventional Commits)

커밋 메시지는 Conventional Commits 형식을 엄격히 따릅니다.

```bash
# 커밋 형식:
# <타입>(<범위>): <설명> (#이슈번호)
#
# 타입:
#   feat     — 신규 기능
#   fix      — 버그 수정
#   docs     — 문서만 변경
#   refactor — 리팩토링 (기능 변경 없음)
#   test     — 테스트 추가/수정
#   chore    — 빌드/설정 변경
#   perf     — 성능 개선
#   style    — 포맷 변경 (동작 영향 없음)

# 좋은 커밋 메시지 예시:
git commit -m "feat(ai-service): MTU-N253 CSAP 증적 자동 수집 엔진 구현 (#253)"
git commit -m "fix(auth-service): JWT 만료 토큰 블랙리스트 누락 수정 (#301)"
git commit -m "docs(onboarding): 신규 팀원 기여 가이드 작성"
git commit -m "refactor(audit): 감사 로그 직렬화 로직 분리 (단일 책임)"

# 나쁜 커밋 메시지 예시:
git commit -m "fix"           # 무엇을 고쳤는지 알 수 없음
git commit -m "작업 중"        # 설명 없음
git commit -m "WIP"           # Work In Progress — PR 올리기 전 squash 필요
git commit -m "update stuff"  # 영어로 모호하게
```

**절대 금지**:
```bash
# git 훅 우회 절대 금지 (CLAUDE.md 절대 제약)
git commit --no-verify  # 금지!
git push --force        # 금지!
```

---

### Step 6: PR 제출

```bash
# 원격 저장소에 브랜치 푸시
git push origin feat/N253-csap-evidence-v2

# Gitea 웹 UI에서 PR 생성
# base 브랜치: stg
# compare 브랜치: feat/N253-csap-evidence-v2
```

PR 제출 전 자가 점검:

```
□ PR 제목에 이슈 번호가 포함되어 있는가? (#XXX)
□ PR 설명이 아래 가이드를 따르는가? (3절 참조)
□ 로컬 테스트가 모두 통과했는가?
□ 새 파일에 민감 정보가 없는가? (.env, 시크릿, 키)
□ 변경 파일 목록을 검토했는가? (의도하지 않은 파일 포함 여부)
```

---

### Step 7: Q-Gate 통과 대기

PR이 생성되면 Gitea Actions가 자동으로 Q-Gate 파이프라인을 실행합니다.

```
Q-Gate 7단계:
  G1: 요구사항 FR ID 전수 확인 (Auditor 에이전트)
      → 구현 코드와 Plan 문서의 FR ID 매핑 확인
      → 실패 시: Plan 문서에 FR ID 추가 후 재커밋

  G2: 설계 완전성 검사 (Auditor 에이전트)
      → Design 문서 존재 여부, 추적성 매트릭스 확인
      → 실패 시: Design 문서 보완

  G3: 코드 품질 + AgentShield 102규칙 (Reviewer 에이전트)
      → ESLint, TypeScript 타입 검사, 정적분석
      → 실패 시: 린트/타입 오류 수정

  G4: 테스트 커버리지 80%+ (Tester 에이전트)
      → Jest 커버리지 리포트 분석
      → 실패 시: 테스트 케이스 추가

  G5: OWASP Top10 통과 (Reviewer 에이전트)
      → SQL 주입, XSS, 하드코딩 시크릿 등 보안 스캔
      → 실패 시: 보안 취약점 수정

  G6: CSAP 해당 Phase 100% (Auditor 에이전트)
      → CSAP 79항목 중 해당 통제항목 준수 확인
      → 실패 시: CSAP 요건 누락 부분 보완

  G7: 감사 추적 audit.jsonl 완비 (Auditor 에이전트)
      → 민감 작업에 auditLog() 호출 여부 확인
      → 실패 시: auditLog 추가
```

Q-Gate 실패 시 PR 댓글에 실패 원인이 기록됩니다. 수정 후 `git push`만 하면 자동 재실행됩니다.

---

### Step 8: Reviewer 리뷰 통과

Q-Gate가 모두 통과하면 지정된 Reviewer에게 리뷰 요청이 자동으로 전송됩니다.

```
리뷰 기준:
  - 코드 가독성 (80줄 이하 함수, 명확한 변수명)
  - 단일 책임 원칙 준수
  - Dead code 없음
  - 보안 패턴 준수 (csap-compliance.md)
  - 테스트 케이스의 적절성
```

리뷰 댓글 유형:
- **[Blocker]**: 머지 전 반드시 수정 필요
- **[Suggestion]**: 권장 사항 (수정 선택)
- **[Question]**: 이해를 위한 질문 (답변 필요)
- **[Nitpick]**: 사소한 스타일 의견 (수정 선택)

---

### Step 9: stg 머지 → 통합 테스트

Reviewer 승인 후 PR이 `stg` 브랜치에 머지됩니다. 머지 후 스테이징 환경에서 통합 테스트를 수행합니다.

```bash
# stg 환경에서 확인해야 할 사항:
# 1. 서비스 정상 기동 여부
kubectl -n saas-stg get pods

# 2. 헬스체크 엔드포인트 응답
curl https://stg-api.공공saas.go.kr/health

# 3. 주요 E2E 시나리오 수동 검증
# 4. 모니터링 대시보드 이상 없음 확인
```

---

### Step 10: main 머지 → 운영 배포

스테이징 테스트 통과 후 `stg → main` PR을 생성합니다. `main` 머지는 Flux GitOps를 통해 자동으로 운영 배포됩니다.

```
main 머지 권한:
  - 테크 리드 또는 시니어 엔지니어만 가능
  - 반드시 2명 이상의 Reviewer 승인 필요
  - 운영 배포 전 릴리즈 노트 작성 필수

자동 배포:
  main 머지 → Flux 감지 (30초 이내) → Helm 업그레이드
  → 롤링 업데이트 → 헬스체크 → 완료
```

---

## 3. PR 설명 작성 가이드

PR 설명은 리뷰어와 미래의 팀원을 위한 소통 창구입니다.

### 3.1 PR 설명 템플릿

```markdown
## 개요
[이 PR이 무엇을 하는지 한 문단으로 설명]

Closes #[이슈번호]

## 변경 사항

### 추가된 기능
- [기능 1]
- [기능 2]

### 수정된 버그
- [버그 설명] → [수정 방법]

### 삭제된 코드
- [삭제 이유]

## 관련 요구사항
| FR ID | 설명 | 구현 위치 |
|-------|------|---------|
| FR-X.X | [설명] | `src/handlers/xxx.ts` |

## CSAP 영향도
- [ ] D-06 감사 로그: auditLog() 추가 완료
- [ ] D-08 접근 통제: RBAC 검사 추가 완료
- [ ] D-09 암호화: 민감 데이터 암호화 적용
- [ ] D-12 입력 검증: Zod 스키마 적용

## 테스트 계획
- [ ] 단위 테스트: [파일명] — [테스트 케이스 수]건 추가
- [ ] 통합 테스트: [테스트 시나리오]
- [ ] 수동 테스트: [확인 방법]

## 스크린샷 (UI 변경 시)
[변경 전 / 변경 후]

## 배포 시 주의 사항
- [ ] DB 마이그레이션 필요: `prisma migrate deploy`
- [ ] 환경 변수 추가 필요: `NEW_FEATURE_FLAG=true`
- [ ] 배포 순서: auth-service 먼저, api-gateway 나중
```

### 3.2 좋은 PR 설명 예시

```markdown
## 개요
CSAP 증적 자동 수집 엔진을 구현합니다. 기존에 수동으로 작성하던
CSAP 79항목 이행 증적을 코드 레벨에서 자동으로 수집하고 구조화된
JSON 형식으로 저장합니다. MTU-N253 요건을 충족합니다.

Closes #253

## 변경 사항

### 추가된 기능
- `CsapEvidenceCollector` 클래스: 코드 분석 기반 증적 자동 수집
- `EvidenceRepository`: 증적 데이터 PostgreSQL JSONB 저장
- `GET /api/v1/csap/evidence/:controlId`: 특정 통제항목 증적 조회 API
- Cron 스케줄러: 매일 새벽 2시 자동 증적 갱신

## 관련 요구사항
| FR ID | 설명 | 구현 위치 |
|-------|------|---------|
| FR-7.1 | CSAP 증적 자동 수집 | `src/lib/csap-evidence-collector.ts` |
| FR-7.2 | 증적 조회 API | `src/handlers/evidence.handler.ts` |

## CSAP 영향도
- [x] D-06 감사 로그: 증적 조회 시 auditLog() 추가
- [x] D-08 접근 통제: admin 또는 auditor 역할만 조회 가능
- [x] D-12 입력 검증: controlId 형식 Zod 검증

## 테스트 계획
- [x] 단위 테스트: `csap-evidence-collector.test.ts` — 27건 추가
- [x] 통합 테스트: DB 저장 → API 조회 E2E 시나리오
- [x] 커버리지: 82.4% (G4 통과)

## 배포 시 주의 사항
- [x] DB 마이그레이션 필요: `prisma migrate deploy`
  새 테이블 `csap_evidence` 생성
```

### 3.3 나쁜 PR 설명 예시 (피해야 할 것)

```markdown
## 나쁜 예 1: 내용 없음
CSAP 기능 추가

## 나쁜 예 2: 변경 목록만 있고 이유가 없음
- csap-evidence-collector.ts 파일 추가
- 테스트 추가
- API 엔드포인트 추가

## 나쁜 예 3: 리뷰어에게 부담 전가
바빠서 설명 쓸 시간이 없어서 생략합니다. 코드 보시면 알 것 같아요.

## 나쁜 예 4: 과도하게 큰 PR (설명도 방대함)
300개 파일 변경, 5000줄 추가 — 이런 PR은 만들지 마십시오.
PR 하나는 하나의 논리적 변경만 담아야 합니다.
```

---

## 4. 코드 리뷰 에티켓

### 4.1 리뷰어(Reviewer)의 역할과 책임

**리뷰어가 해야 할 것**:

```
1. PR 수신 후 24시간 내 초기 응답 (바쁜 경우에도 예상 완료 시간 댓글 필수)

2. 댓글 분류 명확히 표시:
   [Blocker] 이 부분은 보안 취약점입니다. 반드시 수정 후 재검토 요청 바랍니다.
   [Suggestion] 이 패턴보다는 Zod .transform()을 쓰면 더 명확합니다.
   [Question] 이 상수의 의미를 설명해 주실 수 있을까요?
   [Nitpick] 변수명을 data보다 auditRecord로 하면 어떨까요?

3. 코드를 설명하는 댓글에는 왜 문제인지 반드시 설명:
   나쁜 댓글: "이렇게 하지 마세요"
   좋은 댓글: "이 방식은 CSAP D-12 위반입니다. 
              SQL 직접 결합은 SQL 주입 취약점을 만듭니다.
              매개변수화 쿼리로 수정해 주십시오. (csap-compliance.md 참조)"

4. 긍정적인 부분도 언급:
   "이 부분의 에러 처리가 매우 잘 되었습니다."

5. PR 전체를 읽지 않고 일부만 보고 승인하지 않기
```

**리뷰어가 하지 말아야 할 것**:

```
- 개인 취향을 [Blocker]로 표시하기 (스타일 의견은 [Nitpick])
- 코드 작성자의 능력을 의심하는 표현 사용
- 댓글 없이 "Changes requested" 반환
- 48시간 이상 리뷰 없이 방치
- 리뷰 중 코드를 직접 수정 (수정 제안만 가능, 직접 편집 불가)
```

### 4.2 PR 작성자(Reviewee)의 역할과 책임

**PR 작성자가 해야 할 것**:

```
1. 모든 댓글에 응답 (수락/거절 이유 포함):
   수락: "수정 완료했습니다. 5번 커밋에서 Zod .transform()으로 변경했습니다."
   거절: "이 패턴은 FR-2.3 요건에서 명시적으로 요구하는 방식입니다.
          (docs/01-plan/mtus/MTU-N253.plan.md 참조)"

2. 리뷰 완료 후 "재검토 요청" 버튼으로 명시적으로 알리기
   (리뷰어가 직접 PR을 확인하기를 기다리지 않기)

3. 대규모 변경이 필요한 경우 리뷰어에게 먼저 논의 요청
   (큰 변경 = 잘못된 방향으로 진행 중일 수 있음)

4. [Blocker] 댓글은 모두 해결한 후에만 재검토 요청
```

**PR 작성자가 하지 말아야 할 것**:

```
- 댓글을 무시하고 그냥 머지 버튼 누르기
- "제 생각에는..." 식으로 리뷰어 의견을 무시
- 리뷰 없이 PR을 self-merge
- 리뷰어 교체 없이 48시간 이상 방치
```

### 4.3 리뷰 SLA (Service Level Agreement)

| 단계 | 목표 시간 |
|------|---------|
| 리뷰 초기 응답 | PR 수신 후 24시간 이내 |
| 1차 리뷰 완료 | PR 수신 후 48시간 이내 |
| 댓글 수정 완료 | 피드백 수신 후 24시간 이내 |
| 최종 승인 | 재검토 요청 후 24시간 이내 |

---

## 5. CLAUDE.md 절대 제약 요약

다음 규칙들은 어떠한 예외도 없습니다. 위반 시 Q-Gate에서 자동 차단되며, 심각한 경우 감리 결함으로 기록됩니다.

### 5.1 구현 순서 제약

```
절대 제약: 문서 없는 구현 = 감리 결함

필수 순서:
  1. Plan 문서 작성 (docs/01-plan/mtus/*.plan.md)
  2. Design 문서 작성 (포함: 추적성 매트릭스, ADR)
  3. 구현 시작 (feat/ 브랜치)
  4. 테스트 작성
  5. 리뷰 및 감리

이 순서를 바꾸거나 생략하는 것은 금지입니다.
```

### 5.2 보안 절대 제약

```
금지 항목:
  ❌ 하드코딩된 시크릿 (API 키, 비밀번호, 토큰, 인증서)
  ❌ C/S 등급 데이터를 AI API(외부 Claude API 포함)로 전송
  ❌ git commit --no-verify (훅 우회)
  ❌ git push --force (감사 추적 파괴)
  ❌ DROP TABLE, DELETE FROM (WHERE 절 없음)
  ❌ 외부 클라우드 서비스 사용 (AI/LLM API 제외)

필수 항목:
  ✅ 모든 API 엔드포인트에 RBAC 검사
  ✅ 민감 작업에 auditLog() 호출
  ✅ 모든 입력에 Zod 검증
  ✅ SQL 쿼리 매개변수화
  ✅ 암호화: AES-256 (저장), TLS 1.3+ (전송)
```

### 5.3 Git 제약

```
금지:
  ❌ --no-verify 플래그
  ❌ --force 푸시
  ❌ main 브랜치 직접 커밋 (PR 없이)
  ❌ 의미 없는 커밋 메시지 ("fix", "wip", "update")

필수:
  ✅ Conventional Commits 형식
  ✅ 모든 커밋에 관련 이슈/MTU 번호
  ✅ stg → main PR에 릴리즈 노트
```

### 5.4 문서 제약

```
금지:
  ❌ 영어 문서 (한국어 전용, 공공기관 표준 용어)
  ❌ 문서 없는 구현
  ❌ 추적성 매트릭스 없는 Plan 문서

필수:
  ✅ 모든 문서: 한국어, 공공기관 표준 용어
  ✅ FR-X.X, NFR-X 형식의 요구사항 ID
  ✅ 4방향 추적성 (FR↔산출물↔테스트↔CSAP)
```

---

## 6. 자주 하는 실수 TOP 10

신규 팀원이 자주 저지르는 실수를 정리했습니다. 이 목록을 숙지하면 시행착오를 크게 줄일 수 있습니다.

### 실수 1: Plan 문서 없이 구현 시작

```
상황: "간단한 기능이라 빨리 만들고 문서는 나중에..."
결과: Q-Gate G1/G2 실패 → PR 반려 → 문서 작성 → 코드 수정
피해 시간: 실제로 문서 먼저 쓰는 것보다 3배 더 오래 걸림

해결책: 아무리 작은 기능이라도 MTU Plan 파일을 먼저 만드십시오.
        5줄짜리 Plan이라도 없는 것보다 낫습니다.
```

### 실수 2: 환경 변수를 코드에 하드코딩

```typescript
// 실수: 자주 발생하는 패턴
const apiKey = 'sk-ant-api03-...'  // CSAP D-09 위반!
const dbUrl = 'postgresql://admin:password@localhost:5432/db'  // 위반!

// 올바른 방법:
const apiKey = process.env.ANTHROPIC_API_KEY
if (!apiKey) throw new Error('ANTHROPIC_API_KEY 환경 변수가 설정되지 않았습니다')
```

이 실수는 Q-Gate G5(OWASP)와 G6(CSAP D-09)에서 자동 차단됩니다.

### 실수 3: auditLog() 호출 누락

```typescript
// 실수: 민감 작업에 감사 로그 없음
async function deleteUser(userId: string) {
  await userRepository.delete(userId)  // D-06 위반!
}

// 올바른 방법:
async function deleteUser(actor: AuthenticatedUser, userId: string) {
  await auditLog({
    actor: actor.id, action: 'USER_DELETE', target: userId,
    timestamp: new Date().toISOString(),
  })
  await userRepository.delete(userId)
}
```

### 실수 4: main 브랜치에서 직접 브랜치 생성

```bash
# 실수:
git checkout main
git checkout -b feat/new-feature  # main 기반 → stg와 충돌 위험

# 올바른 방법:
git checkout stg
git pull origin stg
git checkout -b feat/new-feature  # stg 기반
```

### 실수 5: 대용량 PR 제출

```
실수: 하나의 PR에 5개 기능 + 3개 버그 수정 + 문서 20개 포함

문제:
  - 리뷰어가 검토하는 데 반나절 이상 소요
  - 리뷰 퀄리티 저하 → 보안 결함 통과 위험
  - 머지 충돌 가능성 증가

해결책:
  - PR 하나 = 하나의 논리적 변경
  - 파일 변경 수 > 20개면 분리를 고려
  - 큰 기능은 단계적 PR (기반 구조 → 핵심 로직 → UI 순)
```

### 실수 6: 테스트 없이 PR 제출

```
실수: "기능 구현은 완료했는데 테스트는 나중에..."

결과: Q-Gate G4(커버리지 80%)에서 자동 실패

올바른 습관:
  - TDD(Test Driven Development) 권장
  - 최소한 핵심 경로(happy path)와 에러 케이스는 반드시 테스트
  - Claude Code Tester 에이전트를 활용하면 테스트 자동 생성 가능
```

### 실수 7: Conventional Commits 미준수

```bash
# 실수:
git commit -m "fixed the bug"
git commit -m "작업"
git commit -m "asdf"

# 올바른 방법:
git commit -m "fix(auth-service): 로그아웃 후 JWT 블랙리스트 갱신 누락 수정 (#301)"
```

### 실수 8: 다른 팀원의 작업 브랜치에 직접 커밋

```
실수: 동료의 feat/xxx 브랜치에 직접 push

문제:
  - 동료의 작업 흐름 방해
  - 예상치 못한 코드 변경으로 혼란

올바른 방법:
  - 피드백은 PR 댓글로
  - 공동 작업 필요 시 Pair Programming 또는 새 브랜치 생성 후 PR 연결
```

### 실수 9: stg → main 자동 머지 시도

```
실수: stg에서 직접 main으로 PR 없이 머지 시도

실제 발생 사례:
  - git merge main stg (반대 방향 실수)
  - git push origin HEAD:main (직접 푸시 시도)

결과: 브랜치 보호 규칙에 의해 자동 차단 + 감사 로그 기록

올바른 방법:
  - 반드시 Gitea 웹 UI에서 PR 생성
  - 테크 리드 2명 이상 승인 후 머지
```

### 실수 10: C/S 등급 데이터를 AI API로 전송

```typescript
// 실수: 개인정보가 포함된 민원 내용을 그대로 AI에 전송
const response = await claude.messages.create({
  messages: [{
    role: 'user',
    content: `민원 내용: ${rawCitizenComplaint}`,  // N2SF 위반!
  }]
})

// 올바른 방법:
const maskedContent = await maskPII(rawCitizenComplaint)
if (dataGrade === DataGrade.C || dataGrade === DataGrade.S) {
  throw new Error('C/S 등급 데이터는 AI API 전송 불가 (N2SF N-05)')
}
const response = await claude.messages.create({
  messages: [{ role: 'user', content: maskedContent }]
})
```

---

## 7. 긴급 상황 Hotfix 절차

운영 환경에서 심각한 장애가 발생한 경우, 일반 PR 절차를 일부 단축하여 신속하게 대응합니다. 단, 모든 단축은 기록되어야 합니다.

### 7.1 Hotfix 발동 기준

다음 중 하나에 해당하는 경우에만 Hotfix 절차를 적용합니다.

```
기준 1: 서비스 전면 중단 (P0 장애)
  - API 게이트웨이 다운
  - 인증 서비스 불능
  - 데이터베이스 연결 불가

기준 2: 심각한 보안 취약점 (즉각 패치 필요)
  - 인증 우회 취약점 발견
  - 데이터 노출 위험
  - CSAP 긴급 보안 패치 요건

기준 3: 데이터 손상 위험
  - 잘못된 쿼리로 데이터 오염
  - 마이그레이션 실패
```

### 7.2 Hotfix 단계별 절차

```
Step 1: 장애 선언 (5분 내)
  - Slack #incident 채널에 장애 선언
  - Incident Commander 지정
  - 영향 범위 초기 평가

Step 2: Hotfix 브랜치 생성 (10분 내)
  git checkout main  # 운영 코드 기반
  git pull origin main
  git checkout -b hotfix/P0-auth-bypass-fix

Step 3: 최소한의 수정 (15~30분)
  - 장애 원인만 수정 (새 기능 추가 금지)
  - 기존 테스트가 통과하는지 확인
  - 새 회귀 테스트 최소 1건 추가

Step 4: 긴급 리뷰 (10분)
  git push origin hotfix/P0-auth-bypass-fix
  # Gitea에서 hotfix → main PR 생성
  # [HOTFIX] 태그 반드시 제목에 포함
  # 온콜 담당자 2명에게 즉시 Slack DM으로 리뷰 요청

Step 5: 단축 Q-Gate (자동)
  # G3(코드 품질), G5(OWASP), G7(감사 로그)만 필수 실행
  # G1, G2, G4, G6는 72시간 내 사후 보완 계약

Step 6: 긴급 머지 및 배포 (5분)
  # 승인 받은 즉시 main 머지
  # Flux 자동 배포 또는 kubectl rollout 수동 배포

Step 7: 장애 해제 선언
  - 서비스 정상 확인
  - Slack #incident 에 해제 선언
  - 운영 메트릭 30분 모니터링

Step 8: 사후 보완 (72시간 내)
  - 단축된 Q-Gate 항목 소급 완료
  - 사후 보고서 작성 (장애 원인, 조치 내용, 재발 방지)
  - Plan/Design 문서 소급 작성
  - 감사 로그에 Hotfix 이벤트 기록
```

### 7.3 Hotfix 금지 사항

```
절대 금지 (Hotfix 상황에서도):
  ❌ 하드코딩된 시크릿 추가
  ❌ git push --force
  ❌ 승인 없이 main 직접 push
  ❌ 사후 보완 없이 단축 절차 종결
```

---

## 8. 신규 서비스 추가하는 방법

새로운 마이크로서비스를 추가하는 10단계 절차입니다.

### Step 1: 서비스 설계 문서 작성

```bash
# 서비스 Plan 문서 생성
touch docs/01-plan/mtus/MTU-SVC-새서비스.plan.md

# 필수 포함 내용:
# - 서비스 목적 및 책임 범위
# - FR-X.X 요구사항 목록
# - 의존 서비스 목록
# - API 인터페이스 명세
# - CSAP 관련 통제항목
```

### Step 2: 서비스 디렉토리 생성

```bash
# 표준 디렉토리 구조
mkdir -p platform/services/새서비스-service/src/{handlers,lib,routes}
mkdir -p platform/services/새서비스-service/src/types
mkdir -p platform/services/새서비스-service/tests

# 표준 파일 생성
touch platform/services/새서비스-service/src/index.ts
touch platform/services/새서비스-service/src/routes.ts
touch platform/services/새서비스-service/package.json
touch platform/services/새서비스-service/tsconfig.json
touch platform/services/새서비스-service/Dockerfile
```

### Step 3: package.json 설정

```json
{
  "name": "@public-saas/새서비스-service",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "node --watch --loader ts-node/esm src/index.ts",
    "build": "tsc",
    "test": "node --test tests/**/*.test.ts",
    "test:coverage": "node --test --experimental-test-coverage tests/**/*.test.ts",
    "lint": "eslint src tests"
  },
  "dependencies": {
    "fastify": "^5.0.0",
    "zod": "^3.0.0",
    "@public-saas/audit": "workspace:*",
    "@public-saas/crypto": "workspace:*"
  }
}
```

### Step 4: Fastify 서버 기본 구조

```typescript
// src/index.ts
import Fastify from 'fastify'
import { routes } from './routes.js'

const app = Fastify({ logger: true })

app.register(routes, { prefix: '/api/v1' })

app.get('/health', async () => ({ status: 'ok' }))

await app.listen({ port: Number(process.env.PORT ?? 3XXX), host: '0.0.0.0' })
```

### Step 5: 포트 번호 등록

```
포트 번호 규칙 (platform/docs/port-registry.md 참조):
  3000: api-gateway
  3001: auth-service
  3002: user-service
  3003: tenant-service
  ...
  새 서비스 포트는 port-registry.md에 등록 필수
```

### Step 6: pnpm workspace 등록

```yaml
# pnpm-workspace.yaml에 이미 platform/services/** 패턴이 있음
# 별도 등록 불필요 — 디렉토리 생성만으로 자동 인식
```

### Step 7: Prisma 스키마 추가 (DB 사용 시)

```prisma
// prisma/schema.prisma에 새 모델 추가
model NewEntity {
  id        String   @id @default(uuid())
  tenantId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId])
}
```

```bash
# 마이그레이션 생성
pnpm --filter @public-saas/db prisma migrate dev --name add_new_entity
```

### Step 8: Helm 차트 추가

```bash
# 기존 서비스의 Helm 차트를 복사하여 수정
cp -r platform/infra/helm/auth-service platform/infra/helm/새서비스-service
# values.yaml에서 이미지명, 포트, 환경 변수 수정
```

### Step 9: Flux GitOps 배포 설정

```yaml
# platform/infra/gitops/apps/새서비스-service.yaml
apiVersion: helm.toolkit.fluxcd.io/v2beta1
kind: HelmRelease
metadata:
  name: 새서비스-service
  namespace: saas-prod
spec:
  interval: 5m
  chart:
    spec:
      chart: ./platform/infra/helm/새서비스-service
      sourceRef:
        kind: GitRepository
        name: public-saas
```

### Step 10: 서비스 등록 및 검증

```bash
# api-gateway에 라우트 등록
# platform/services/api-gateway/src/routes/새서비스.ts 생성

# 전체 빌드 확인
pnpm build

# 전체 테스트 확인
pnpm test

# k3s 배포 확인
kubectl apply -f platform/infra/gitops/apps/새서비스-service.yaml
kubectl -n saas-dev get pods | grep 새서비스
```

---

## 9. 신규 패키지 추가하는 방법

여러 서비스에서 공통으로 사용하는 라이브러리를 패키지로 만드는 5단계 절차입니다.

### Step 1: 패키지 필요성 검토

```
패키지를 만들기 전에 다음 질문에 답하십시오:

  Q1: 이 코드가 3개 이상의 서비스에서 필요한가?
      아니오 → 서비스 내부에 유지
      예 → 패키지 검토

  Q2: 기존 packages/ 디렉토리에 유사한 패키지가 없는가?
      있음 → 기존 패키지 확장 검토
      없음 → 신규 패키지 생성

  Q3: 이 패키지가 공개 API를 포함하는가?
      예 → deprecation 정책 수립 필요
```

### Step 2: 패키지 디렉토리 생성

```bash
# 예: CSAP 공통 유틸리티 패키지
mkdir -p packages/csap-utils/src
touch packages/csap-utils/src/index.ts
touch packages/csap-utils/package.json
touch packages/csap-utils/tsconfig.json
```

### Step 3: package.json 설정

```json
{
  "name": "@public-saas/csap-utils",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "node --test tests/**/*.test.ts"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

### Step 4: 사용하는 서비스에서 의존성 추가

```json
// platform/services/auth-service/package.json
{
  "dependencies": {
    "@public-saas/csap-utils": "workspace:*"
  }
}
```

```bash
# 의존성 설치
pnpm install
```

### Step 5: 문서화 및 등록

```typescript
// packages/csap-utils/src/index.ts — 공개 API 명확히 export
export { validateCsapControlId } from './csap-validator.js'
export { CsapControlLevel } from './types.js'
// 내부 유틸리티는 export하지 않음
```

```bash
# packages/README.md 또는 패키지 내 README.md에 사용법 문서화
# (docs 규칙: 한국어로 작성)
```

---

## 10. 기여 전체 흐름 다이어그램

```mermaid
%%{init: {'theme': 'default'}}%%
flowchart TD
    Start([기여 시작]) --> Issue[Gitea에서\nIssue 생성]
    Issue --> Doc{신규 기능인가?}

    Doc -- "예" --> Plan[Plan 문서 작성\ndocs/01-plan/mtus/]
    Doc -- "버그 수정" --> Branch

    Plan --> Design[Design 문서 작성\n추적성 매트릭스 포함]
    Design --> Branch[feat/ 또는 fix/\n브랜치 생성 from stg]

    Branch --> Code[코드 작성\nCLAUDE.md 규칙 준수]
    Code --> Test[로컬 테스트\npnpm test:coverage]

    Test --> TestPass{커버리지\n80% 이상?}
    TestPass -- "아니오" --> MoreTest[테스트 추가]
    MoreTest --> Test

    TestPass -- "예" --> Commit[커밋\nConventional Commits]
    Commit --> PR[PR 제출\nstg 기반]

    PR --> QGate[Q-Gate 자동 실행\n7단계 파이프라인]

    QGate --> G1{G1: FR ID\n전수?}
    G1 -- "실패" --> FixDoc[문서 보완]
    FixDoc --> QGate

    G1 -- "통과" --> G3{G3: 코드 품질\n+AgentShield?}
    G3 -- "실패" --> FixCode[코드 수정]
    FixCode --> QGate

    G3 -- "통과" --> G5{G5: OWASP\nTop10?}
    G5 -- "실패" --> FixSecurity[보안 취약점 수정]
    FixSecurity --> QGate

    G5 -- "통과" --> G7{G7: 감사 로그\n완비?}
    G7 -- "실패" --> FixAudit[auditLog 추가]
    FixAudit --> QGate

    G7 -- "모두 통과" --> Review[Reviewer 리뷰]
    Review --> Approved{승인?}

    Approved -- "변경 요청" --> FixReview[댓글 반영\n재검토 요청]
    FixReview --> Review

    Approved -- "승인" --> MergeStg[stg 머지]
    MergeStg --> IntTest[스테이징 통합 테스트]
    IntTest --> MergeMain[main 머지 PR\n테크 리드 승인]
    MergeMain --> Deploy[운영 자동 배포\nFlux GitOps]
    Deploy --> Done([완료])

    style Done fill:#2E7D32,color:#fff
    style QGate fill:#1565C0,color:#fff
    style Deploy fill:#1565C0,color:#fff
```

---

## 11. PR → Q-Gate → 머지 시퀀스

```mermaid
%%{init: {'theme': 'default'}}%%
sequenceDiagram
    actor Dev as 개발자
    participant Gitea as Gitea
    participant Actions as Gitea Actions
    participant QGate as Q-Gate 파이프라인
    participant Reviewer as Reviewer
    participant Flux as Flux GitOps
    participant K3s as k3s 클러스터

    Dev->>Gitea: git push feat/xxx
    Dev->>Gitea: PR 생성 (stg 기반)

    Gitea->>Actions: PR 이벤트 트리거

    Actions->>QGate: Q-Gate 시작

    Note over QGate: G1: FR ID 전수 검사
    QGate->>QGate: Plan 문서 ↔ 코드 FR ID 매핑

    Note over QGate: G2: 설계 완전성
    QGate->>QGate: Design 문서 존재 + 추적성 매트릭스

    Note over QGate: G3: 코드 품질 + AgentShield
    QGate->>QGate: ESLint + TypeCheck + 102규칙

    Note over QGate: G4: 테스트 커버리지 80%+
    QGate->>QGate: Jest 커버리지 측정

    Note over QGate: G5: OWASP Top10
    QGate->>QGate: 보안 취약점 스캔

    Note over QGate: G6: CSAP 해당 Phase
    QGate->>QGate: CSAP 통제항목 준수 확인

    Note over QGate: G7: 감사 추적 완비
    QGate->>QGate: auditLog() 호출 확인

    alt Q-Gate 실패
        QGate->>Gitea: PR 댓글에 실패 원인 기록
        Gitea->>Dev: 알림 전송
        Dev->>Dev: 수정 및 재커밋
        Dev->>Gitea: git push (자동 재실행)
    else Q-Gate 통과
        QGate->>Gitea: 통과 상태 업데이트
        Gitea->>Reviewer: 리뷰 요청 전송
    end

    Reviewer->>Gitea: 코드 리뷰
    alt 변경 요청
        Reviewer->>Gitea: Changes requested
        Gitea->>Dev: 피드백 알림
        Dev->>Dev: 수정 후 재검토 요청
        Dev->>Reviewer: 재검토 요청
        Reviewer->>Gitea: 승인
    else 즉시 승인
        Reviewer->>Gitea: Approved
    end

    Gitea->>Gitea: stg 브랜치에 머지
    Dev->>K3s: 스테이징 테스트 수행
    K3s-->>Dev: 테스트 결과

    Dev->>Gitea: stg → main PR 생성
    Note over Gitea: 테크 리드 2명 이상 승인 필요
    Reviewer->>Gitea: 2명 승인
    Gitea->>Gitea: main 머지

    Gitea->>Flux: 커밋 이벤트 (Webhook)
    Flux->>Flux: HelmRelease 감지 (30초 이내)
    Flux->>K3s: Helm 업그레이드 적용
    K3s->>K3s: 롤링 업데이트 실행
    K3s-->>Flux: 배포 완료
    Flux-->>Dev: 배포 완료 알림
```

---

## 12. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|------|
| 1.0.0 | 2026-04-12 | 최초 작성 — 기여 가이드 전체 작성 | Implementer (Sonnet) |

---

*이 가이드에 대한 질문이나 개선 의견은 Gitea에 Issue를 등록하십시오.*
*가이드 자체도 PR을 통해 개선할 수 있습니다. 기여를 환영합니다.*
