# `/av` Auto-Vibe Plugin Advisor — Design 문서

> **Feature**: av-skill
> **버전**: 1.0.0
> **작성일**: 2026-04-05
> **작성자**: PDCA Design Phase (Claude Code)
> **상태**: Draft
> **아키텍처**: Option C — 실용적 균형 (SKILL.md + 3개 참조 파일)
> **관련 Plan**: `docs/01-plan/features/av-skill.plan.md`

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 설치된 플러그인들이 너무 복잡하고, 사용자는 무엇을 써야 할지 몰라 실제로 사용하지 못한다. 단일 자연어 진입점으로 이 문제를 해결한다 |
| **WHO** | (1) 신입 개발자 — 플러그인 존재 자체를 모름 (2) 중급 개발자 — 일부 알지만 최적 조합 모름 (3) 시니어 개발자 — 빠른 자동화 원함 |
| **RISK** | LLM 의도 분류 정확도 불확실성, 200개+ 매핑 테이블 유지보수 부담, 컨텍스트 윈도우 제약 |
| **SUCCESS** | 의도 분류 > 90%, 응답 < 3초, 파일 크기 < 50KB, PDCA 연동 100% |
| **SCOPE** | bkit v2.0.8 + ECC v1.9.0 라우팅. 플러그인 설치/개발은 범위 외 |

---

## 1. 개요 (Overview)

### 1.1 아키텍처 결정: Option C (실용적 균형)

**선택 근거**: SKILL.md에 핵심 로직을 인라인으로 유지하되, 대용량 매핑 테이블과 카탈로그는 별도 참조 파일로 분리. 4개 파일로 관리 복잡성 최소화하면서 컨텍스트 윈도우 효율성 확보.

### 1.2 배포 위치 및 구조

```
~/.claude/skills/av/
├── SKILL.md                  (~10KB, 주요 로직 인라인)
└── references/
    ├── intent-map.md         (~15KB, 6-의도별 30개 핵심 구성요소)
    ├── skill-catalog.md      (~20KB, bkit+ECC 전체 200개+ 카탈로그)
    └── execution-rules.md    (~5KB, 직렬/병렬 실행 규칙)
```

**총 크기 목표**: < 50KB (NFR-AV-5)

### 1.3 핵심 설계 원칙

1. **SKILL.md는 오케스트레이터**: 분류·선택·실행·제안 로직만 포함, 데이터는 참조 파일로
2. **미리보기 필수**: 실행 전 항상 계획 표시 + 사용자 확인 (FR-AV-3.2)
3. **점진적 컨텍스트 로드**: 의도 파악 후 해당 의도 매핑만 로드 (컨텍스트 절약)
4. **폴백 내성**: 구성요소 호출 실패 시 대체 경로 제공
5. **PDCA 네이티브**: 실행 흐름이 PDCA 사이클과 자연스럽게 통합

---

## 2. SKILL.md 상세 설계

### 2.1 프론트매터

```yaml
---
name: av
description: |
  Auto-Vibe Plugin Advisor — 자연어 요구사항을 분석하여
  최적의 bkit/ECC 플러그인 구성요소를 자동 선택·실행하고
  PDCA 다음 단계를 안내하는 지능형 라우터.
  사용법: /av [요구사항] [--dry-run] [--yes]
triggers:
  - pattern: "/av"
  - pattern: "/auto-vibe"
context:
  - path: "references/intent-map.md"
    description: "6-의도별 구성요소 매핑 테이블"
  - path: "references/execution-rules.md"
    description: "직렬/병렬 실행 규칙"
version: "1.0.0"
compatible_with: "bkit>=2.0.0,ecc>=1.9.0"
---
```

### 2.2 실행 흐름 (7단계)

```
STEP 1: 옵션 파싱
  └─ --dry-run 감지 → 실행 없이 계획만 출력
  └─ --yes 감지 → 미리보기 후 자동 확인
  └─ 나머지 → 자연어 요구사항

STEP 2: 컨텍스트 수집 (< 1초)
  ├─ Read: .bkit/state/memory.json → 프로젝트 레벨
  ├─ Glob: package.json / go.mod / requirements.txt → 기술 스택
  ├─ Read: .bkit/state/*.json → PDCA 현재 단계
  └─ Grep: CLAUDE.md "CSAP" → 공공기관 여부

STEP 3: 의도 분류 (< 2초)
  ├─ LLM 프롬프트로 6-의도 분류 (아래 §2.3)
  ├─ 신뢰도 계산
  └─ 신뢰도 < 70% → AskUserQuestion으로 명확화

STEP 4: 구성요소 선택 (< 0.5초)
  ├─ Read: references/intent-map.md (해당 의도 섹션)
  ├─ 컨텍스트 필터링 (레벨 / 스택 / PDCA 단계)
  └─ 최적 조합 결정 (최대 5개 구성요소)

STEP 5: 실행 계획 미리보기 (항상)
  └─ 번호 목록 + 직렬/병렬 표시 + 선택 근거

STEP 6: 사용자 확인
  ├─ --yes 플래그: 자동 진행
  ├─ --dry-run: 여기서 종료
  └─ 기본: AskUserQuestion "이 구성으로 진행할까요?"

STEP 7: 실행 + 결과 + 다음 단계 제안
  ├─ 구성요소 순차/병렬 호출
  ├─ 각 단계 완료 표시 [1/4] ✅
  └─ 완료 후 PDCA 다음 단계 제안
```

### 2.3 의도 분류 프롬프트 설계

```
[시스템 지침 — 의도 분류]

사용자 요구사항을 분석하여 다음 6가지 의도 중 하나 이상을 분류하세요.

의도 체계:
1. IMPLEMENT — 새 기능 구현, 코드 작성, 추가 개발
   키워드: 만들어, 구현, 추가, 개발, 작성, 생성, 빌드
2. REVIEW — 코드 리뷰, 품질 검사, 분석
   키워드: 리뷰, 검사, 분석, 확인, 점검, 검토
3. DESIGN — 설계, 계획, 아키텍처, PRD
   키워드: 설계, 계획, 아키텍처, 구조, PRD, 명세
4. DEPLOY — 배포, 인프라, CI/CD, 릴리즈
   키워드: 배포, 릴리즈, 인프라, CI/CD, 서버, 컨테이너
5. SECURITY — 보안 감사, CSAP, 취약점, 감리
   키워드: 보안, CSAP, 취약점, 감리, 감사, N2SF
6. LEARN — 학습, 설명, 온보딩, 가이드
   키워드: 배워줘, 설명해줘, 알려줘, 가이드, 온보딩

컨텍스트: {project_level} / {tech_stack} / {pdca_phase}
요구사항: "{user_input}"

출력:
- 의도: [IMPLEMENT | REVIEW | DESIGN | DEPLOY | SECURITY | LEARN] (복수 가능)
- 신뢰도: [0-100]%
- 핵심 키워드: 근거가 된 단어들
```

### 2.4 미리보기 출력 형식

```
📋 /av 실행 계획
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
의도: IMPLEMENT (신뢰도: 95%)
컨텍스트: Dynamic 프로젝트 / TypeScript / PDCA: plan 단계

선택된 구성요소 (4개):
  1. [SKILL]  /pdca plan user-auth     — 요구사항 분석 및 계획 수립
  2. [SKILL]  /bkend-auth              — JWT 인증 구현 (TypeScript 감지)
  3. [AGENT]  implementer              — 설계 기반 코드 생성
  4. [AGENT]  reviewer                 — 보안 코드 리뷰

실행 순서: 1→2→3→4 (직렬, 각 단계 의존성 있음)
예상 소요: 각 구성요소 실행 포함 15-30분

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
이 구성으로 진행할까요?
```

### 2.5 다음 단계 제안 로직

| 실행된 의도 | 다음 단계 제안 |
|-----------|-------------|
| IMPLEMENT | `/pdca analyze {feature}` — 갭 분석으로 구현 검증 |
| REVIEW | 이슈 발견 시: `/pdca iterate {feature}` / 이슈 없음: `/pdca report {feature}` |
| DESIGN | `/pdca do {feature}` — 구현 단계 시작 |
| DEPLOY | 배포 완료 확인, 모니터링 설정 권장 |
| SECURITY | 고위험 발견 시: 즉시 수정 / 저위험: 다음 스프린트 계획 |
| LEARN | 관련 PDCA 단계 안내 |

---

## 3. references/intent-map.md 설계

### 3.1 파일 구조

```markdown
# Intent-to-Component Mapping Table
# Version: 1.0.0 (bkit 2.0.8 + ECC 1.9.0)
# 업데이트: 분기별 검토 필요

## IMPLEMENT (구현)
### 신규 기능 구현
- P0 스킬: /pdca (plan→design→do), /dynamic, /enterprise
- P0 에이전트: implementer, bkend-expert (백엔드)
- P1 스킬: /bkend-auth (인증), /bkend-data (데이터), /bkend-storage (파일)
- P1 스킬: /phase-1-schema ~ /phase-9-deployment
- ECC 스킬: nextjs-turbopack (Next.js), springboot-patterns (Spring), django-patterns (Django)
- ECC 에이전트: architect, planner
- 실행 순서: plan → design → [언어별 스킬] → implementer → reviewer

### TypeScript/Next.js 프로젝트
- 우선 스킬: /bkend-auth, nextjs-turbopack, frontend-patterns
- 우선 에이전트: frontend-architect, bkend-expert, typescript-reviewer

### Python 프로젝트
- 우선 스킬: django-patterns, python-patterns
- 우선 에이전트: python-reviewer

### Go 프로젝트
- 우선 스킬: golang-patterns
- 우선 에이전트: go-reviewer

## REVIEW (리뷰)
### 코드 품질 검사
- P0 에이전트: code-analyzer, reviewer (bkit)
- P0 ECC 에이전트: 언어별 reviewer (아래 스택별)
- 병렬 실행: [typescript-reviewer || python-reviewer || go-reviewer] + security-reviewer
- P1 스킬: /code-review (bkit), code-review (ECC)
- 직렬: [병렬 리뷰] → code-analyzer → 결과 요약

### TypeScript 스택
- 에이전트: typescript-reviewer, database-reviewer (DB 쿼리 있는 경우)

### Python 스택
- 에이전트: python-reviewer

### Go 스택
- 에이전트: go-reviewer

### 보안 집중 리뷰
- 에이전트: security-reviewer (ECC), security-architect (bkit)
- 스킬: security-review, security-scan

## DESIGN (설계)
### 신규 기능 설계
- P0 스킬: /pdca plan, /pdca design
- P1 스킬: /plan-plus (복잡한 기능)
- P0 에이전트: enterprise-expert (Enterprise), cto-lead (팀 조율)
- ECC 스킬: architecture-decision-records, api-design
- 실행 순서: [pm 선택적] → plan → design

### 시스템 아키텍처 설계
- 에이전트: enterprise-expert, infra-architect
- 스킬: hexagonal-architecture, api-design

## DEPLOY (배포)
### 앱 배포
- P0 스킬: /phase-9-deployment, /deploy
- P0 에이전트: infra-architect
- ECC 스킬: deployment-patterns, docker-patterns
- 실행 순서: phase-9-deployment → deploy → 검증

### 롤백
- 스킬: /rollback

## SECURITY (보안)
### CSAP/감리 (공공기관)
- P0 에이전트: auditor (bkit, Opus), security-architect
- P0 스킬: /audit
- ECC 에이전트: security-reviewer
- 실행 순서: [security-scan || audit] → security-architect → report-generator

### 일반 보안 스캔
- 에이전트: security-reviewer (ECC)
- 스킬: security-review, security-scan

## LEARN (학습)
### 온보딩/입문
- P0 에이전트: starter-guide, pipeline-guide
- P0 스킬: /starter, /claude-code-learning, /development-pipeline
- ECC 스킬: codebase-onboarding

### 특정 기술 학습
- ECC 스킬: [언어별 patterns], [언어별 testing]
- ECC 에이전트: docs-lookup (문서 조회)
```

---

## 4. references/execution-rules.md 설계

### 4.1 직렬/병렬 결정 규칙

```markdown
# 실행 순서 결정 규칙

## 직렬 실행 (Sequential) 조건
- 이전 구성요소의 출력이 다음 구성요소의 입력인 경우
- 예: plan → design (design이 plan 문서 필요)
- 예: implementer → reviewer (구현 코드가 리뷰 대상)

## 병렬 실행 (Parallel) 조건
- 독립적인 검사 작업 (서로 의존 없음)
- 예: typescript-reviewer || security-reviewer (동시 실행 가능)
- 예: security-scan || audit (독립적)

## 의존성 그래프 (핵심)
pdca-pm → pdca-plan → pdca-design → implementer → reviewer → auditor
                                                   ↑
                                              [language-reviewer]

## 실행 시간 예측
- 스킬 호출: 0.1~0.5초
- 에이전트 (Haiku): 5~15초
- 에이전트 (Sonnet): 15~60초
- 에이전트 (Opus): 30~120초

## 최대 구성요소 수
- 단일 /av 호출: 최대 5개 구성요소
- 복합 의도: 의도별 2개씩 최대 10개
```

---

## 5. references/skill-catalog.md 설계

### 5.1 카탈로그 구조 (핵심 부분)

```markdown
# bkit + ECC 전체 스킬/에이전트 카탈로그
# Version: bkit 2.0.8 + ECC 1.9.0

## bkit 스킬 (36개)

### PDCA 관련 (9개)
| 스킬 | 용도 | 의도 |
|------|------|------|
| /pdca plan | Plan 문서 생성 | DESIGN |
| /pdca design | Design 문서 생성 | DESIGN |
| /pdca do | 구현 가이드 | IMPLEMENT |
| /pdca analyze | 갭 분석 | REVIEW |
| /pdca iterate | 자동 개선 | IMPLEMENT |
| /pdca report | 완료 보고서 | REVIEW |
| /pdca status | PDCA 현황 | LEARN |
| /pdca pm | PM 팀 분석 | DESIGN |
| /plan-plus | 심화 계획 | DESIGN |

[... 전체 카탈로그 계속 ...]
```

---

## 6. 컨텍스트 감지 상세 설계

### 6.1 프로젝트 레벨 감지

```
우선순위:
1. .bkit/state/memory.json 읽기 → "level" 필드
2. bkit.config.json 읽기 → "level" 필드
3. 코드베이스 복잡도 추정 (package.json 의존성 수)
   - < 10개: Starter
   - 10~30개: Dynamic
   - 30개+: Enterprise

레벨별 구성요소 제한:
- Starter: bkit 기본 + ECC 패턴 스킬만
- Dynamic: 전체 bkit + ECC (Agent Teams 제외)
- Enterprise: 전체 + cto-lead + Agent Teams
```

### 6.2 기술 스택 감지

```
감지 파일 → 기술 스택 → 우선 언어 Reviewer

package.json 존재 → TypeScript/JavaScript
  └─ "next" 의존성 → Next.js → typescript-reviewer + nextjs-turbopack
  └─ "react" → React → typescript-reviewer + frontend-patterns
  └─ "express"/"fastify" → Node.js API → typescript-reviewer + backend-patterns

requirements.txt / pyproject.toml 존재 → Python
  └─ "django" → Django → python-reviewer + django-patterns
  └─ "fastapi" → FastAPI → python-reviewer + backend-patterns

go.mod 존재 → Go
  └─ go-reviewer + golang-patterns

pom.xml / build.gradle 존재 → Java/Kotlin
  └─ java-reviewer / kotlin-reviewer + springboot-patterns

Cargo.toml 존재 → Rust
  └─ rust-reviewer + rust-patterns

(없음) → 알 수 없음 → 범용 code-analyzer
```

### 6.3 공공기관 컨텍스트 감지

```
CLAUDE.md 내 키워드 Grep:
- "CSAP" OR "N2SF" OR "감리" OR "공공기관" → 공공기관 모드 활성화

공공기관 모드 시 추가 구성요소:
- SECURITY 의도: auditor 에이전트 (Opus) 자동 추가
- REVIEW 의도: code-analyzer + auditor 병렬 실행
- IMPLEMENT 의도: 완료 후 /audit 실행 제안
- 모든 의도: 감사 로그 (.claude/audit.jsonl) 기록 권장
```

---

## 7. 에러 처리 및 폴백 설계

### 7.1 의도 분류 실패

```
신뢰도 < 70%:
  → AskUserQuestion: "어떤 작업을 원하시나요?"
    옵션: [구현] [리뷰] [설계] [배포] [보안] [학습]

완전히 분류 불가:
  → "요구사항을 좀 더 구체적으로 말씀해주세요" + 예시 제공
```

### 7.2 구성요소 미설치

```
bkit 스킬 호출 실패:
  → "bkit 플러그인이 설치되지 않았습니다. 설치 후 다시 시도하세요."
  → ECC 대체 스킬 제안 (가능한 경우)

ECC 스킬 호출 실패:
  → bkit 대체 스킬 제안 (가능한 경우)
  → 수동 실행 가이드 제공
```

### 7.3 컨텍스트 파일 없음

```
.bkit/state/memory.json 없음:
  → 프로젝트 레벨: "Dynamic" 기본값 적용
  → 경고: "레벨 감지 실패. Dynamic으로 기본 설정됩니다."

CLAUDE.md 없음:
  → 공공기관 모드 비활성화 (정상)
```

---

## 8. 테스트 계획

### 8.1 의도 분류 테스트 케이스 (TC-1~25)

| TC | 입력 | 기대 의도 | 신뢰도 |
|----|------|---------|--------|
| TC-1 | "로그인 기능 만들어줘" | IMPLEMENT | > 90% |
| TC-2 | "이 코드 리뷰해줘" | REVIEW | > 90% |
| TC-3 | "인증 시스템 설계해줘" | DESIGN | > 90% |
| TC-4 | "프로덕션에 배포해줘" | DEPLOY | > 90% |
| TC-5 | "CSAP 감리 준비해줘" | SECURITY | > 90% |
| TC-6 | "Claude Code 사용법 알려줘" | LEARN | > 90% |
| TC-7 | "구현하고 리뷰도 해줘" | IMPLEMENT+REVIEW | > 85% |
| TC-8 | "login feature please" | IMPLEMENT | > 90% |
| TC-9 | "뭔가 이상해" | 신뢰도 < 70% → 명확화 요청 | — |
| TC-10 | "JWT token auth system" | IMPLEMENT+SECURITY | > 85% |
| TC-11~25 | (다양한 시나리오) | 각 의도 커버 | > 90% |

### 8.2 구성요소 선택 테스트 (TC-16~20)

| TC | 컨텍스트 | 의도 | 기대 구성요소 |
|----|---------|------|-------------|
| TC-16 | TypeScript + Dynamic | IMPLEMENT | typescript-reviewer, bkend-auth, implementer |
| TC-17 | Python + Starter | IMPLEMENT | python-reviewer (ECC 패턴만) |
| TC-18 | 공공기관 + CSAP | SECURITY | auditor (Opus), security-architect |
| TC-19 | 미리보기 형식 | any | 번호 목록 + 근거 포함 확인 |
| TC-20 | --dry-run 옵션 | any | 실행 없이 계획만 출력 확인 |

### 8.3 비기능 테스트

| TC | 테스트 | 측정 | 기준 |
|----|-------|------|------|
| TC-21 | 응답 시간 (의도 분류) | 초시계 측정 | < 3초 |
| TC-22 | 파일 크기 합계 | du -sh | < 50KB |
| TC-23 | 한국어 정확도 | 25개 KR 케이스 | > 90% |
| TC-24 | 영어 정확도 | 25개 EN 케이스 | > 90% |
| TC-25 | 미확인 실행 차단 | --yes 없이 실행 시도 | 확인 단계 출력 확인 |

---

## 9. 구현 순서 (Implementation Guide)

### 9.1 모듈 맵

| 모듈 | 파일 | 의존성 | 추정 크기 |
|------|------|--------|---------|
| M1: 메인 스킬 | `SKILL.md` | 없음 | ~10KB |
| M2: 의도 매핑 | `references/intent-map.md` | M1 | ~15KB |
| M3: 스킬 카탈로그 | `references/skill-catalog.md` | M1 | ~20KB |
| M4: 실행 규칙 | `references/execution-rules.md` | M1 | ~5KB |

### 9.2 구현 순서

```
[Session 1] M1 + M2 (핵심 기능)
  - SKILL.md 프론트매터 + 실행 흐름 7단계
  - 의도 분류 프롬프트 + 미리보기 형식
  - references/intent-map.md (6-의도 30개 핵심 매핑)
  → /av 기본 동작 가능

[Session 2] M3 + M4 (완전한 기능)
  - references/skill-catalog.md (전체 200개+ 카탈로그)
  - references/execution-rules.md (직렬/병렬 규칙 상세)
  → 전체 기능 완성

[Session 3] 검증 + 튜닝
  - TC-1~25 테스트 실행
  - 의도 분류 정확도 튜닝
  - 공공기관 컨텍스트 검증
```

### 11.3 Session Guide

| 세션 | 범위 | 목표 |
|------|------|------|
| `/pdca do av-skill --scope m1,m2` | SKILL.md + intent-map | 기본 /av 작동 |
| `/pdca do av-skill --scope m3,m4` | skill-catalog + rules | 전체 기능 완성 |
| 검증 세션 | 테스트 케이스 실행 | 품질 기준 충족 |

---

## 10. 추적성 매트릭스

| FR | 설계 컴포넌트 | 파일 | 테스트 |
|----|------------|------|--------|
| FR-AV-1.1~1.4 | §2.3 의도 분류 프롬프트 | SKILL.md | TC-1~9 |
| FR-AV-2.1~2.5 | §3.1 intent-map.md | references/intent-map.md | TC-10~15 |
| FR-AV-3.1 | §4.1 실행 규칙 | references/execution-rules.md | TC-21~23 |
| FR-AV-3.2~3.4 | §2.4 미리보기 + §2.2 STEP 6 | SKILL.md | TC-19~20 |
| FR-AV-4.1~4.2 | §2.5 다음 단계 제안 | SKILL.md | TC-25 |
| FR-AV-5.1~5.3 | §6.1~6.3 컨텍스트 감지 | SKILL.md | TC-16~18 |
| NFR-AV-1~7 | §8.3 비기능 테스트 | — | TC-21~24 |

---

## 11. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 (Option C 선택) | PDCA Design Phase |
