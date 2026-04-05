# 공공기관 SaaS 프레임워크 — 프로젝트 하네스

> **기반**: Everything Claude Code (ECC) v1.9.0
> **인증 목표**: CSAP 중/상 등급 + 행안부 정보화사업 감리기준 준수
> **버전**: 1.0.0 | 작성일: 2026-04-05

---

## 1. 절대 제약 (Absolute Constraints)

다음 제약은 어떤 상황에서도 예외 없이 적용됩니다.

- **[필수]** 구현 착수 전 Plan + Design 문서 완비 필수. 문서 없는 구현 = 감리 결함.
- **[필수]** `.env`, `secrets.*`, `*credential*` 파일 커밋 절대 금지.
- **[필수]** `git push --force`, `rm -rf /*`, `DROP TABLE`, `DELETE FROM` (WHERE 없음) 금지.
- **[필수]** 외부 클라우드 서비스 사용 금지. AI/LLM API만 예외 (N2SF O등급 데이터 + 마스킹 후).
- **[필수]** AI API 호출: N2SF C/S 등급 데이터 전송 절대 금지. PII는 마스킹 필수.
- **[필수]** `git commit --no-verify` 또는 훅 우회 명령 사용 금지 (ECC `block-no-verify` 훅).
- **[필수]** 모든 문서: 한국어 전용, 공공기관 표준 용어 사용.

---

## 2. 에이전트 분업 원칙 (Cascade 메서드)

5개 전문 에이전트가 분업하여 고품질 산출물을 생성합니다.
에이전트 간 결과물은 **파일로 전달** (컨텍스트 직접 공유 아님).

```
연구 → 계획 → 구현 → 리뷰 → 감리 → 테스트 → 리팩토링
```

| 에이전트 | 파일 | 모델 | 역할 |
|---------|------|------|------|
| Implementer | `.claude/agents/implementer.md` | Sonnet | 설계 기반 구현 |
| Reviewer | `.claude/agents/reviewer.md` | Sonnet | 코드 품질·보안 검사 (수정 불가) |
| Auditor | `.claude/agents/auditor.md` | **Opus** | CSAP·N2SF·감리 준수 검증 (읽기 전용) |
| Tester | `.claude/agents/tester.md` | Sonnet | 테스트 케이스 작성·실행 |
| Refactorer | `.claude/agents/refactorer.md` | **Haiku** | Dead code 제거·구조 개선 |

**워크플로우**: Implementer 완료 → Reviewer 자동 호출 → 통과 시 Auditor → Tester → Refactorer

---

## 3. 문서 형식 기준 (감리 최적화)

모든 문서는 행안부 정보시스템 감리기준(고시 제2023-1호) 형식을 따릅니다.

**요구사항 ID 체계** (일관성 필수):
- 기능 요구사항: `FR-{모듈}.{번호}` (예: FR-1.1, FR-2.3)
- 비기능 요구사항: `NFR-{번호}` (예: NFR-1)
- 인프라 요구사항: `INFR-{번호}` (예: INFR-1)
- AI 연동 요구사항: `AI-REQ-{번호}` (예: AI-REQ-1)
- CC 하네스 요구사항: `CC-REQ-{번호}` (예: CC-REQ-1)

**필수 섹션** (모든 PDCA 문서에 포함):
- Executive Summary (4-Perspective 테이블)
- Context Anchor (WHY/WHO/RISK/SUCCESS/SCOPE)
- 변경 이력 (버전·일자·내용·작성자)
- 추적성 매트릭스 (FR↔산출물↔테스트↔CSAP 4방향)

---

## 4. Dead Code 정책 (ECC refactor-cleaner 기반)

- 미사용 함수·변수: 발견 즉시 제거하거나 사유 주석 필수 (`// NOTE: 미사용, 이유: XXX`)
- Phase 완료 시: Refactorer 에이전트 실행 필수
- 주간 자동 실행: `/loop 7d npm run audit:dead-code` (또는 `vulture`)
- 예외: 공개 API (deprecation 정책 적용), 테스트 fixture, 마이그레이션 스크립트

---

## 5. CSAP/N2SF 준수 규칙

코드 변경 시 `.claude/rules/csap-compliance.md` 내용 확인 필수.

**핵심 보안 요건**:
- 하드코딩된 시크릿(API 키, 비밀번호, 토큰) 절대 금지
- 모든 사용자 입력: 검증 + 매개변수화 쿼리 (SQL 주입 방지)
- RBAC: 모든 API 엔드포인트에 권한 검사 (CSAP D-08)
- 암호화: AES-256 (저장), TLS 1.3+ (전송) (CSAP D-09)
- 감사 로그: 모든 민감 작업 전수 기록 → `.claude/audit.jsonl` (CSAP D-06)

---

## 6. ECC 하네스 통합

**훅 프로필**: `strict` (모든 훅 활성화)
**거버넌스 캡처**: `ECC_GOVERNANCE_CAPTURE=1` (민감 작업 전수 로깅)

**AgentShield**: 모든 코드 변경 시 102개 정적분석 규칙 자동 실행
**Continuous Learning**: 세션 종료 시 공공 SaaS 패턴 자동 추출 → `~/.claude/skills/`

**7단계 품질 게이트** (Q-GATE):
- G1: 요구사항 FR ID 전수 (Auditor)
- G2: 설계 완전성 (Auditor)
- G3: 코드 품질 + AgentShield 102규칙 (Reviewer)
- G4: 테스트 커버리지 80%+ (Tester)
- G5: OWASP Top10 통과 (Reviewer)
- G6: CSAP 해당 Phase 100% (Auditor)
- G7: 감사 추적 `audit.jsonl` 완비 (Auditor)

---

## 7. 모델 라우팅 (비용 최적화)

| 용도 | 모델 | 이유 |
|------|------|------|
| 구현·리뷰·테스트 | `claude-sonnet-4-6` | 표준 복잡도, 200K 컨텍스트 |
| 감리·규제 분석 | `claude-opus-4-6` | 복합 CSAP/N2SF 분석 필요 |
| 리팩토링·탐색 | `claude-haiku-4-5` | 단순 정리, 최소 비용 |

**컨텍스트 관리**: 50% 임계값 자동 압축. 논리적 지점에서 수동 `/compact` 권장.

---

*이 파일은 프로젝트 하네스의 핵심입니다. 변경 시 팀 전체와 협의 후 변경 이력에 기록하십시오.*
