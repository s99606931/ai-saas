# MTU-F6: CC 하네스 완성도 검증 Design 문서

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-F6 |
| Phase | Phase 1 Foundation |
| 버전 | 0.1.0 |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| 작성자 | PM Lead Agent (Claude Code) |
| 관련 Plan | docs/01-plan/mtus/MTU-F6-harness-verify.plan.md |
| 관련 Framework Design | docs/02-design/features/public-saas-framework.design.md 5절 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 하네스가 올바르지 않으면 이후 모든 MTU 산출물 품질이 보장되지 않음. Phase 1 완료 게이트 |
| **WHO** | 프레임워크 사용 기업의 DevOps 담당자, 프로젝트 관리자 |
| **RISK** | 에이전트 파일 누락, 훅 프로필 미적용, 환경변수 미설정 시 보안 게이트 무력화 |
| **SUCCESS** | 구성 파일 10개 전수 확인, 5개 에이전트 모델 라우팅 확인, Q-Gate G1~G3 통과 |
| **SCOPE** | `10-cc-harness/harness-verification-guide.md` 1개 파일 (절차서형) |

---

## 1. 설계 개요

### 1.1 설계 목적

실제 하네스 구성 파일을 검증하는 절차서를 작성합니다. 이 절차서는 프레임워크를 새로 도입하는 기업이 CC 하네스를 올바르게 구성했는지 자가 검증하는 가이드입니다.

### 1.2 문서 유형

절차서형 (Framework Design 3.3절). 5개 섹션:
1. 하네스 구성 파일 검증
2. 5개 에이전트 동작 확인
3. strict 훅 프로필 검증
4. 7단계 Q-Gate 검증 절차
5. 모델 라우팅 검증

---

## 2. 현행 하네스 상태 분석 (설계 근거)

현재 프로젝트의 실제 하네스 구성을 분석하여 절차서 내용을 결정합니다.

### 2.1 구성 파일 존재 현황

| 파일 경로 | 존재 여부 | 핵심 내용 |
|---------|---------|---------|
| `CLAUDE.md` | 존재 | 7단계 Q-Gate, 모델 라우팅, 절대 제약 정의 |
| `.claude/settings.json` | 존재 | strict 훅 프로필, ECC_GOVERNANCE_CAPTURE=1 |
| `.claude/agents/implementer.md` | 존재 | Sonnet 모델, 설계 기반 구현 |
| `.claude/agents/reviewer.md` | 존재 | Sonnet 모델, 코드 품질/보안 검사 |
| `.claude/agents/auditor.md` | 존재 | Opus 모델, CSAP/N2SF/감리 준수 검증 |
| `.claude/agents/tester.md` | 존재 | Sonnet 모델, 테스트 케이스 작성/실행 |
| `.claude/agents/refactorer.md` | 존재 | Haiku 모델, Dead code 제거 |
| `.claude/rules/csap-compliance.md` | 존재 | D-06/D-08/D-09/D-12 규칙 |
| `.claude/rules/deadcode-policy.md` | 존재 | Dead code 처리 기준 |
| `.claude/rules/harness-constraints.md` | 존재 | 코딩 스타일, Git 워크플로우 |

### 2.2 훅 설정 현황

settings.json에 다음 훅이 정의되어 있음:
- `pre:bash:block-no-verify` -- git 훅 우회 차단
- `pre:bash:destructive-guard` -- 위험 명령 차단

---

## 3. 구현 가이드

### 3.1 파일 경로

```
docs/framework/10-cc-harness/harness-verification-guide.md
```

### 3.2 구현 순서

1. 디렉토리 생성 (`10-cc-harness/`)
2. 절차서 메타데이터 헤더 작성
3. 5개 섹션 순차 작성
4. 검증 명령어 코드블록 포함
5. 변경 이력 섹션 추가

---

## 4. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 -- 현행 하네스 상태 분석 기반 설계 | PM Lead Agent |
