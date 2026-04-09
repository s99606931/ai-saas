# MTU-F6: CC 하네스 완성도 검증

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-F6 |
| Phase | Phase 1 Foundation |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| FR 매핑 | CC-REQ-1, CC-REQ-2, CC-REQ-3 |
| 의존 MTU | 없음 (독립 MTU — 하네스 자체 검증) |
| 예상 세션 | 1 세션 |

---

## 목적

ECC(Everything Claude Code) v1.9.0 기반 공공기관 SaaS 하네스가 올바르게 구성되었음을 검증합니다. CLAUDE.md 정책 적용 확인, 5개 에이전트의 정상 기동, 7단계 Q-GATE 동작, `strict` 훅 프로필, `ECC_GOVERNANCE_CAPTURE=1` 환경변수까지 전수 확인합니다.

**중요성**: 하네스가 올바르게 구성되지 않으면 이후 모든 MTU의 산출물 품질이 보장되지 않습니다. Phase 1 완료 게이트 중 하나로, 다른 MTU와 달리 하네스 구성 파일(기존 파일) 검증이 주 목적입니다.

---

## 산출물 파일 (1개)

| 파일 | 문서 유형 | 핵심 내용 |
|------|---------|---------|
| `10-cc-harness/harness-verification-guide.md` | 절차서형 | 하네스 검증 절차 + 에이전트별 동작 확인 + Q-GATE 검증 |

---

## 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|----|---------|---------|
| CC-REQ-1 | 5개 에이전트 정상 기동 확인 | Implementer·Reviewer·Auditor·Tester·Refactorer 각각 응답 확인 |
| CC-REQ-2 | strict 훅 프로필 적용 확인 | block-no-verify 훅 동작 테스트, --no-verify 시도 차단 확인 |
| CC-REQ-3 | Q-GATE G1~G7 검증 절차 완비 | 각 Gate의 통과 기준 및 확인 방법 문서화 |

---

## 핵심 설계 내용

### harness-verification-guide.md 구성

검증 가이드는 다음 5개 섹션으로 구성됩니다.

---

#### 섹션 1: 하네스 구성 파일 검증

검증할 파일 목록과 각 파일의 필수 내용을 확인합니다.

| 파일 경로 | 필수 확인 내용 | 검증 명령 |
|---------|------------|---------|
| `/data/ai-saas/CLAUDE.md` | 7단계 Q-GATE 정의 존재 | `grep -c "Q-GATE" CLAUDE.md` ≥ 1 |
| `/data/ai-saas/.claude/settings.json` | strict 훅 프로필 설정 | `cat .claude/settings.json` 내 `"hookProfile": "strict"` 확인 |
| `/data/ai-saas/.claude/agents/implementer.md` | 에이전트 역할 정의 | 파일 존재 + 비어있지 않음 |
| `/data/ai-saas/.claude/agents/reviewer.md` | 에이전트 역할 정의 | 파일 존재 + 비어있지 않음 |
| `/data/ai-saas/.claude/agents/auditor.md` | Opus 모델 지정 | `grep "opus" auditor.md` |
| `/data/ai-saas/.claude/agents/tester.md` | 에이전트 역할 정의 | 파일 존재 + 비어있지 않음 |
| `/data/ai-saas/.claude/agents/refactorer.md` | Haiku 모델 지정 | `grep "haiku" refactorer.md` |
| `/data/ai-saas/.claude/rules/csap-compliance.md` | D-08/D-09/D-06 규칙 | `grep -c "CSAP-D" csap-compliance.md` ≥ 3 |
| `/data/ai-saas/.claude/rules/deadcode-policy.md` | Dead code 처리 기준 | 파일 존재 + 비어있지 않음 |
| `/data/ai-saas/.claude/rules/harness-constraints.md` | 코딩 스타일 규칙 | 파일 존재 + 비어있지 않음 |

#### 섹션 2: 5개 에이전트 동작 확인

각 에이전트의 기동 확인 절차와 기대 응답을 정의합니다.

**에이전트 기동 확인 절차**:

| 에이전트 | 모델 | 호출 방법 | 기대 응답 | 실패 시 조치 |
|---------|------|---------|---------|-----------|
| Implementer | Sonnet | `@implementer [작업 요청]` | 설계 기반 구현 착수 응답 | `.claude/agents/implementer.md` 파일 확인 |
| Reviewer | Sonnet | `@reviewer [검토 요청]` | 코드 품질·보안 검사 응답 (수정 불가 확인) | `.claude/agents/reviewer.md` 파일 확인 |
| Auditor | Opus | `@auditor [감리 요청]` | CSAP·N2SF·감리 준수 검증 응답 (읽기 전용 확인) | `.claude/agents/auditor.md` + Opus 모델 설정 확인 |
| Tester | Sonnet | `@tester [테스트 요청]` | 테스트 케이스 작성 응답 | `.claude/agents/tester.md` 파일 확인 |
| Refactorer | Haiku | `@refactorer [리팩토링 요청]` | Dead code 제거·구조 개선 응답 | `.claude/agents/refactorer.md` + Haiku 모델 설정 확인 |

**Cascade 워크플로우 검증**:

```
Implementer 완료 → Reviewer 자동 호출 확인
              → Reviewer 통과 → Auditor 자동 호출 확인
                             → Auditor 통과 → Tester 자동 호출 확인
                                           → Tester 완료 → Refactorer 자동 호출 확인
```

각 단계에서 이전 에이전트의 산출물 파일이 다음 에이전트에게 파일로 전달되는지 확인합니다. (직접 컨텍스트 공유 여부 확인)

#### 섹션 3: strict 훅 프로필 검증

`strict` 훅 프로필의 핵심 보안 훅 동작을 테스트합니다.

**block-no-verify 훅 테스트**:

```bash
# 이 명령은 반드시 차단되어야 합니다
git commit --no-verify -m "테스트"
# 기대 결과: "hook: block-no-verify: --no-verify 사용 금지" 오류 발생
```

**force-push 차단 훅 테스트**:

```bash
# 이 명령은 반드시 차단되어야 합니다
git push --force
# 기대 결과: 강제 푸시 차단 오류 발생
```

**ECC_GOVERNANCE_CAPTURE 환경변수 확인**:

```bash
# 다음 환경변수가 설정되어 있어야 합니다
echo $ECC_GOVERNANCE_CAPTURE
# 기대 결과: 1
```

민감 작업(파일 삭제, DB 변경 등) 수행 시 `.claude/audit.jsonl`에 로그가 기록되는지 확인합니다.

#### 섹션 4: 7단계 Q-GATE 검증 절차

각 Q-GATE의 통과 기준과 담당 에이전트, 확인 방법을 정의합니다.

| Gate | 명칭 | 담당 에이전트 | 통과 기준 | 확인 방법 |
|------|------|-----------|---------|---------|
| G1 | 요구사항 FR ID 전수 | Auditor | 모든 산출물에 FR-X.Y ID 존재, 미매핑 0개 | Auditor `@auditor G1 검증` 호출 |
| G2 | 설계 완전성 | Auditor | Plan + Design 문서 구현 착수 전 완비 | Auditor `@auditor G2 검증` 호출 |
| G3 | 코드 품질 + AgentShield 102규칙 | Reviewer | 102개 정적분석 규칙 전수 통과 | Reviewer `@reviewer G3 검증` 호출 |
| G4 | 테스트 커버리지 80%+ | Tester | 테스트 커버리지 리포트 80% 이상 | `npm test -- --coverage` 실행 결과 |
| G5 | OWASP Top 10 통과 | Reviewer | OWASP 10개 항목 전수 통과 | Reviewer `@reviewer G5 검증` 호출 |
| G6 | CSAP 해당 Phase 100% | Auditor | 해당 Phase CSAP 항목 0개 미통과 | Auditor `@auditor G6 검증` 호출 |
| G7 | 감사 추적 audit.jsonl 완비 | Auditor | `.claude/audit.jsonl` 필수 이벤트 전수 기록 | `wc -l .claude/audit.jsonl` + 내용 검토 |

**Q-GATE 통과 시퀀스**: G1 → G2 → G3 → G4 → G5 → G6 → G7 (순서 변경 불가)

#### 섹션 5: 모델 라우팅 검증

CLAUDE.md에 정의된 모델 라우팅 규칙이 실제 에이전트 호출에 적용되는지 확인합니다.

| 용도 | 기대 모델 | 확인 방법 |
|------|---------|---------|
| Implementer (구현) | claude-sonnet-4-6 | 에이전트 응답 헤더 또는 로그 확인 |
| Reviewer (리뷰) | claude-sonnet-4-6 | 에이전트 응답 헤더 또는 로그 확인 |
| Auditor (감리) | claude-opus-4-6 | 에이전트 응답 헤더 또는 로그 확인 |
| Tester (테스트) | claude-sonnet-4-6 | 에이전트 응답 헤더 또는 로그 확인 |
| Refactorer (리팩토링) | claude-haiku-4-5 | 에이전트 응답 헤더 또는 로그 확인 |

**컨텍스트 50% 압축 트리거 확인**: 세션 중 컨텍스트 사용량이 50%에 도달할 때 자동 압축이 실행되는지 확인합니다.

---

## 합격 기준 (Acceptance Criteria)

1. 하네스 구성 파일 10개 전수 존재 및 필수 내용 포함 확인
2. 5개 에이전트 각각 기동 응답 확인 (Auditor는 Opus 모델, Refactorer는 Haiku 모델)
3. `git commit --no-verify` 시도 시 block-no-verify 훅에 의해 차단 확인
4. `ECC_GOVERNANCE_CAPTURE=1` 환경변수 설정 확인
5. 7단계 Q-GATE 각 Gate의 통과 기준과 확인 방법 문서화 완비
6. Cascade 워크플로우 (구현→리뷰→감리→테스트→리팩토링) 순서 강제 동작 확인
7. Q-GATE G1~G3 실제 통과 (Phase 1 완료 게이트 조건)

---

## 테스트 시나리오

**TS-F6-01**: `git commit --no-verify -m "test"` 실행 시 훅 차단 메시지가 나타나고 커밋이 생성되지 않음

**TS-F6-02**: `@auditor`를 호출했을 때 응답에 모델이 Opus임을 나타내는 표시 존재

**TS-F6-03**: `@reviewer`가 보안 취약점(하드코딩된 API 키)이 포함된 코드를 검토 요청 받을 때 HIGH 심각도 플래그를 반환

**TS-F6-04**: `.claude/audit.jsonl` 파일에 최근 민감 작업 이벤트가 기록되어 있음

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 — 5개 에이전트 + 7단계 Q-GATE 검증 절차 설계 | Claude Code |
