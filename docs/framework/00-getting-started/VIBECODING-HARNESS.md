# 바이브코딩 하네스 최적화 가이드

> **MTU-P20** | CSAP 자동 체크 훅 + AI 코드 생성 가이드 + 감리 산출물 자동화

---

## 1. Claude Code 하네스 구조

```
.claude/
  agents/          # 에이전트 정의 (5종)
    implementer.md
    reviewer.md
    auditor.md
    tester.md
    refactorer.md
  rules/           # 하네스 규칙 (3종)
    csap-compliance.md
    deadcode-policy.md
    harness-constraints.md
  audit.jsonl      # 감사 로그
CLAUDE.md          # 프로젝트 하네스 (루트)
```

## 2. CSAP 자동 체크 훅

### 커밋 전 자동 검증

하네스의 `block-no-verify` 훅이 커밋 시 자동으로 다음을 검증합니다:

1. **시크릿 스캔**: `.env`, `secrets.*`, `*credential*` 파일 커밋 차단
2. **SQL 주입 검사**: 문자열 결합 쿼리 패턴 탐지
3. **하드코딩 시크릿**: API 키, 비밀번호 패턴 탐지
4. **Dead code**: 미사용 import/변수 경고

### CSAP 가드 미들웨어

`@public-saas/business-sdk`의 `csapGuard()` 적용 시:
- D-08: RBAC 자동 검증
- D-06: 감사 로그 자동 기록
- D-09: 암호화 헤더 검증

## 3. AI 코드 생성 가이드

### 서비스 핸들러 생성 프롬프트 템플릿

```
서비스명: {서비스명}
Prisma 모델: {모델명}
CRUD 필요: [create, read, update, delete]
CSAP 준수: D-08 RBAC + D-06 감사 로그
Plan 참조: docs/01-plan/mtus/{mtu-id}.plan.md
Design 참조: docs/02-design/mtus/{mtu-id}.design.md
```

### 필수 패턴 (AI 생성 코드에 적용)

1. Zod 스키마 입력 검증 (모든 API 입력)
2. Prisma 매개변수화 쿼리 (SQL 주입 방지)
3. audit-sdk 감사 로그 기록
4. 에러 응답에 민감 정보 미노출
5. RBAC 권한 검사

## 4. 감리 산출물 자동 생성

### PDCA 문서 체인

```
PRD (00-pm/)
  → Plan (01-plan/mtus/)
    → Design (02-design/mtus/)
      → 구현 (platform/)
        → Analysis (03-analysis/)
          → Report (04-report/mtus/)
            → Archive (archive/YYYY-MM/)
```

### 자동 생성 도구

- `/pm` — PM 에이전트 호출 (PDCA 전체 자동화)
- `/av` — 감사 검증 스킬 (Plan + Design 검증)

## 5. 7단계 품질 게이트 (Q-Gate)

| 단계 | 검증 내용 | 에이전트 |
|------|---------|---------|
| G1 | FR ID 전수 확인 | Auditor |
| G2 | 설계 완전성 | Auditor |
| G3 | 코드 품질 + AgentShield 102규칙 | Reviewer |
| G4 | 테스트 커버리지 80%+ | Tester |
| G5 | OWASP Top10 통과 | Reviewer |
| G6 | CSAP 해당 Phase 100% | Auditor |
| G7 | audit.jsonl 완비 | Auditor |
