# Claude Code 오케스트레이션 PRD

| 항목 | 내용 |
|------|------|
| Feature ID | cc-orchestration |
| 버전 | 1.0.0 |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| 작성자 | Claude Code |
| 관련 문서 | docs/00-pm/public-saas-framework.prd.md (Appendix A) |
| ECC 버전 | v1.9.0 |
| CC 버전 | v2.1.71+ |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **문제** | AI 에이전트가 제약 없이 동작할 경우 일관성 결여, dead code 누적, 감리 추적성 미확보 등 공공기관 프로젝트에서 치명적인 결함 발생 |
| **솔루션** | ECC 하네스 엔지니어링 + 5개 전문 에이전트 분업 + 7단계 품질 게이트로 Claude Code를 정해진 제약 안에서 운영 |
| **기능/UX 효과** | 구현→리뷰→감리→테스트→리팩토링이 자동 순환, Dead code 0개 유지, 감사 로그 자동 기록 |
| **핵심 가치** | 공공기관 감리 최적화 AI 개발 환경 — 인간 개입 없이도 CSAP/N2SF 준수 코드와 감리 산출물 자동 생성 |

---

## 1. 하네스 엔지니어링 아키텍처 (ECC 기반)

### 1.1 개념 정의

**Harness Engineering** (2026년 4월 기준):
AI 에이전트 자체가 아닌 **에이전트 주변 시스템**을 설계하는 분야.
에이전트가 접근할 수 있는 도구, 안전성 가드레일, 자체 수정 피드백 루프, 관찰성 레이어를 포함한다.

> "모델 성능보다 모델 주변의 시스템이 프로덕션 품질을 결정한다."
> — Everything Claude Code, ECC v1.9.0

### 1.2 레이어 구성

```
┌──────────────────────────────────────────────────────┐
│  사용자 요청                                           │
└──────────────────────────────────────────────────────┘
           ↓
┌──────────────────────────────────────────────────────┐
│  제약 레이어: CLAUDE.md                                │
│  (절대 제약, 에이전트 분업, 문서 기준, Dead code 정책)  │
└──────────────────────────────────────────────────────┘
           ↓
┌──────────────────────────────────────────────────────┐
│  강제 레이어: Hooks (strict 프로필)                    │
│  PreToolUse → PostToolUse → Stop → SessionStart       │
└──────────────────────────────────────────────────────┘
           ↓
┌──────────────────────────────────────────────────────┐
│  분업 레이어: 5개 전문 에이전트 (Cascade 메서드)        │
│  Implementer → Reviewer → Auditor → Tester → Refactorer │
└──────────────────────────────────────────────────────┘
           ↓
┌──────────────────────────────────────────────────────┐
│  품질 레이어: 7단계 Q-Gate                             │
│  G1(요구사항) → G2(설계) → G3(코드) → G4(테스트)       │
│  → G5(OWASP) → G6(CSAP) → G7(감사)                   │
└──────────────────────────────────────────────────────┘
           ↓
┌──────────────────────────────────────────────────────┐
│  학습 레이어: Continuous Learning v2                   │
│  패턴 자동 추출 → ~/.claude/skills/csap-patterns/      │
└──────────────────────────────────────────────────────┘
```

---

## 2. ECC 컴포넌트 적용 계획

### 2.1 ECC 에이전트 48개 → 5개 선별 (CSAP 최적화)

| ECC 원본 에이전트 | 선별 이유 | 공공 SaaS 에이전트 |
|----------------|---------|----------------|
| `architect` + `planner` | 설계 기반 구현 필수 | **Implementer** |
| `code-reviewer` + `security-reviewer` | AgentShield 102규칙 | **Reviewer** |
| `security-reviewer` + `doc-updater` | CSAP/N2SF/감리 전문 | **Auditor** (Opus) |
| `e2e-runner` + `tdd-guide` | PRD TS-1~TS-6 기반 | **Tester** |
| `refactor-cleaner` | Dead code 0개 정책 | **Refactorer** (Haiku) |

### 2.2 ECC 스킬 활용 계획

| ECC 스킬 | 활용 목적 |
|---------|---------|
| `agentic-engineering` | 멀티 에이전트 오케스트레이션 설계 |
| `autonomous-agent-harness` | 하네스 인프라 구성 |
| `continuous-learning-v2` | 공공 SaaS 패턴 자동 추출 |
| `zero-script-qa` | 스크립트 없는 QA (감리 대응) |
| `api-design` | 보안 게이트웨이 API 설계 |
| `backend-patterns` | 마이크로서비스, 데이터 격리 패턴 |

### 2.3 ECC 훅 프로필 선택 근거

| 프로필 | 대상 환경 | CSAP 적합성 |
|--------|---------|-----------|
| `minimal` | 탐색·학습 | 낮음 |
| `standard` | 일반 개발 | 중간 |
| **`strict`** | **CSAP 중/상 환경** | **높음 (선택)** |

**`strict` 프로필 선택 근거**:
모든 훅 활성화 → 훅 누락으로 인한 감사 추적 공백 방지 → CSAP D-06 침해사고 관리 요건 충족

---

## 3. CLAUDE.md 구성 스펙

파일: `/data/ai-saas/CLAUDE.md`

**7개 필수 섹션**:
1. 절대 제약 (Absolute Constraints) — 예외 없는 금지 사항
2. 에이전트 분업 원칙 (Cascade 메서드) — 5개 에이전트 역할
3. 문서 형식 기준 — 감리 최적화 형식, 요구사항 ID 체계
4. Dead Code 정책 — 발견 즉시 제거, 주간 자동 실행
5. CSAP/N2SF 준수 규칙 — 핵심 보안 요건
6. ECC 하네스 통합 — 훅 프로필, 7단계 Q-Gate
7. 모델 라우팅 — Sonnet/Opus/Haiku 용도별 분리

---

## 4. Hooks 구성 스펙 (strict 프로필)

파일: `/data/ai-saas/.claude/settings.json`

### 4.1 PreToolUse (도구 실행 전 차단)

| 훅 ID | 트리거 | 목적 | Exit Code |
|-------|--------|------|---------|
| `pre:bash:block-no-verify` | Bash | git 훅 우회 차단 | 2 (차단) |
| `pre:bash:destructive-guard` | Bash | rm -rf, DROP TABLE, force push 차단 | 2 (차단) |
| `pre:write:protect-secrets` | Edit/Write | .env, secrets 파일 수정 차단 | 2 (차단) |

### 4.2 PostToolUse (실행 후 기록)

| 훅 ID | 트리거 | 목적 | 비동기 |
|-------|--------|------|-------|
| `post:bash:command-log-audit` | Bash | 감사 로그 기록 → `.claude/audit.jsonl` | ✅ async |
| `post:edit:format-and-log` | Edit/Write | 파일 변경 감사 로그 기록 | ✅ async |

### 4.3 Stop (세션 종료 후)

| 훅 ID | 목적 | 타임아웃 |
|-------|------|---------|
| `stop:session-end` | 세션 종료 상태 저장 | 10초 |

### 4.4 SessionStart (세션 시작 시)

| 훅 ID | 목적 |
|-------|------|
| `start:harness-reminder` | 하네스 제약 재주입 (Dead code, AI 데이터 금지 등) |

---

## 5. 권한 제어 (Permissions)

### Allow (자동 허용)

```json
["Bash(npm test)", "Bash(npm run build)", "Bash(npm run lint)",
 "Bash(git add *)", "Bash(git commit *)", "Bash(git status)",
 "Bash(kubectl get *)", "Bash(kubectl apply *)", "Bash(docker ps)",
 "Bash(mkdir -p *)", "Bash(ls *)", "Bash(grep *)"]
```

### Deny (자동 차단)

```json
["Bash(git push --force*)", "Bash(git push -f*)",
 "Bash(git commit --no-verify*)", "Bash(rm -rf /*)",
 "Bash(kubectl delete namespace*)", "Bash(DROP TABLE*)",
 "Edit(.env)", "Edit(.env.*)", "Write(.env)", "Write(.env.*)"]
```

---

## 6. 5개 전문 에이전트 정의

파일: `/data/ai-saas/.claude/agents/`

| 에이전트 | 파일 | 모델 | 도구 | 권한 | 완료 기준 |
|---------|------|------|------|------|---------|
| implementer | `implementer.md` | Sonnet | Bash, Edit, Write, Read, Glob, Grep | `acceptEdits` | 테스트 통과 + lint 0 |
| reviewer | `reviewer.md` | Sonnet | Read, Bash(검사만), Write(리포트만) | `plan` | APPROVED/BLOCKED 판정 |
| auditor | `auditor.md` | **Opus** | Read, Bash(검사만), Grep | `plan` | AUDIT_REPORT.md 생성 |
| tester | `tester.md` | Sonnet | Read, Bash(test), Write(spec) | `acceptEdits` | 커버리지 80%+ |
| refactorer | `refactorer.md` | **Haiku** | Read, Edit, Bash(lint만) | `acceptEdits` | Dead code 0개 |

---

## 7. Cascade 메서드 워크플로우

```
사용자 요청
     ↓
[Implementer] 설계 기반 구현 + /loop 2m npm test
     ↓ 완료 (IMPL_COMPLETE.md 생성)
[Reviewer] AgentShield 102규칙 + OWASP Top10 자동 검사
     ├── BLOCKED → [Implementer] 재작업
     └── APPROVED → (REVIEW_REPORT.md 생성)
              ↓
         [Auditor] CSAP 79항목 + N2SF 6영역 + 감리 7종 검증 (Opus)
              ├── FAILED → [Implementer] 재작업
              └── PASSED → (AUDIT_REPORT.md + COMPLIANCE_MATRIX.md 생성)
                       ↓
                  [Tester] TS-1~TS-6 시나리오 + 커버리지 측정
                       ├── FAIL → [Implementer] 재작업
                       └── PASS → (TEST_RESULT.md 생성, 커버리지 80%+)
                                ↓
                           [Refactorer] Dead code 탐지·제거 + CHANGELOG 업데이트
                                ↓ Dead code 0개 달성
                           PR 생성 → Gitea Actions CI → 병합
```

### 병렬화 (Cascade + 워크트리)

복잡한 Phase에서는 git worktree를 활용한 병렬 개발:

```bash
git worktree add .worktrees/research origin/main   # 탐색
git worktree add .worktrees/impl main              # 구현
git worktree add .worktrees/review main            # 리뷰
```

---

## 8. Continuous Learning 구성

### 8.1 패턴 추출 (세션 종료 시 자동)

`stop:evaluate-session` 훅 → ECC 패턴 분석 엔진 → 스킬 파일 생성

| 학습 도메인 | 저장 경로 | 적용 시점 |
|----------|---------|---------|
| CSAP 준수 패턴 | `~/.claude/skills/csap-patterns/SKILL.md` | 다음 세션 자동 |
| 감리 산출물 패턴 | `~/.claude/skills/audit-patterns/SKILL.md` | 다음 세션 자동 |
| k3s 구성 패턴 | `~/.claude/skills/k3s-patterns/SKILL.md` | 다음 세션 자동 |
| AI 게이트웨이 패턴 | `~/.claude/skills/ai-gateway-patterns/SKILL.md` | 다음 세션 자동 |

### 8.2 학습 효과 (누적)

| Phase | 예상 비용 절감 | 이유 |
|-------|------------|------|
| Phase 1 완료 후 | 10~20% | 기본 패턴 스킬화 |
| Phase 2 완료 후 | 30~40% | CSAP 항목별 패턴 누적 |
| Phase 3 완료 후 | 50~60% | 전체 도메인 패턴 완성 |

---

## 9. Dead Code 정책 자동화

### 9.1 탐지 스크립트 (`package.json`)

```json
{
  "scripts": {
    "audit:dead-code": "ts-prune --error && python -m pyflakes src/",
    "refactor:auto": "node .claude/scripts/run-refactorer.js"
  }
}
```

### 9.2 자동 실행 스케줄

```bash
# Claude Code /loop 활용
/loop 7d npm run audit:dead-code   # 주간 자동 탐지
```

### 9.3 CSAP 관련 코드 특별 관리

CSAP/N2SF 관련 함수는 제거 전 Auditor 검토 필수:
```typescript
// NOTE: CSAP D-08 AC-07 준수 함수. 제거 전 Auditor 확인 필수.
function enforceSessionLimit(userId: string) { ... }
```

---

## 10. 7단계 품질 게이트 (Q-Gate)

| 게이트 | ID | 담당 에이전트 | 검사 내용 | 통과 기준 | 미통과 시 |
|-------|-----|------------|---------|---------|---------|
| 요구사항 검증 | Q-GATE-01 | Auditor | FR ID 전수, 추적성 매트릭스 | 누락 0개 | Implementer 재작업 |
| 설계 완전성 | Q-GATE-02 | Auditor | Design 문서 11섹션 완비 | 섹션 100% | Implementer 보완 |
| 코드 품질 | Q-GATE-03 | Reviewer | AgentShield 102규칙 | CRITICAL 0개 | Implementer 재작업 |
| 테스트 커버리지 | Q-GATE-04 | Tester | 커버리지 측정 | 80%+(신규), 90%+(변경) | Implementer 보완 |
| OWASP Top10 | Q-GATE-05 | Reviewer | 10개 취약점 검사 | HIGH 이상 0개 | Implementer 재작업 |
| CSAP 준수 | Q-GATE-06 | Auditor | 해당 Phase 통제항목 | 미충족 0개 | Implementer 재작업 |
| 감사 추적 | Q-GATE-07 | Auditor | audit.jsonl 완비 | 기록 완비 | 자동 보완 |

---

## 11. 성공 기준 (KPI)

| KPI ID | 지표명 | 목표값 | 측정 방법 |
|--------|-------|-------|---------|
| CC-K-01 | 7단계 Q-Gate 자동화율 | 100% | 수동 개입 없이 자동 순환 |
| CC-K-02 | Dead code 비율 | 0% | vulture + ts-prune 실행 결과 |
| CC-K-03 | 감사 로그 완비율 | 100% | audit.jsonl 공백 없음 |
| CC-K-04 | CSAP G6 첫 통과율 | 90%+ | Auditor 재작업 요청 횟수 |
| CC-K-05 | 세션당 비용 절감율 | 60%+ | Phase 3 완료 후 측정 |
| CC-K-06 | 에이전트 분업 준수율 | 100% | Cascade 순서 미준수 0건 |

---

## 12. 변경 이력

| 버전 | 일자 | 변경 내용 | 작성자 |
|------|------|---------|-------|
| 1.0.0 | 2026-04-05 | 최초 작성 (ECC v1.9.0 기반) | Claude Code |

---

*이 문서는 행정안전부 정보시스템 감리기준에 따라 작성되었습니다.*
*Everything Claude Code(ECC) v1.9.0 + Claude Code v2.1.71+ 기준.*
