# CC 하네스 완성도 검증 절차서

| 항목 | 내용 |
|------|------|
| 문서 ID | CC-REQ-VERIFY |
| 버전 | 0.1.0 |
| 최종 수정일 | 2026-04-05 |
| 대상 | DevOps 담당자, 프로젝트 관리자 |
| 주기 | 프레임워크 최초 도입 시 1회 + Phase 완료 시 |
| 관련 감리 산출물 | (CC 하네스 자체 검증) |
| FR 매핑 | CC-REQ-1, CC-REQ-2, CC-REQ-3 |

<!-- Design Ref: MTU-F6-harness-verify.design.md 2절 -- 현행 하네스 상태 분석 기반 -->
<!-- Design Ref: Framework Design 5절 -- CC 하네스 통합 설계 -->

---

## 1. 목적 및 범위

본 절차서는 ECC(Everything Claude Code) v1.9.0 기반 공공기관 SaaS 하네스가 올바르게 구성되었음을 검증합니다.

**검증 범위**:
- 하네스 구성 파일 10개 전수 존재 및 필수 내용 확인
- 5개 에이전트(Implementer/Reviewer/Auditor/Tester/Refactorer)의 모델 라우팅 확인
- `strict` 훅 프로필 동작 확인 (보안 훅 차단 검증)
- 7단계 Q-Gate 통과 절차 및 담당 에이전트 확인
- 감사 로그(`audit.jsonl`) 기록 동작 확인

**중요성**: 하네스가 올바르게 구성되지 않으면 이후 모든 MTU의 산출물 품질이 보장되지 않습니다.

---

## 2. 역할 및 책임 (RACI)

| 역할 | 책임 항목 |
|------|---------|
| DevOps 담당자 | 하네스 구성 파일 설치 및 검증 실행 (R) |
| 프로젝트 관리자 | 검증 결과 확인 및 승인 (A) |
| Auditor 에이전트 | Q-Gate G1~G3 자동 검증 (C) |
| Reviewer 에이전트 | 구성 파일 내용 검토 (C) |

---

## 3. 절차 흐름도

```
[Step 1: 구성 파일 검증] → [Step 2: 에이전트 동작 확인] → [Step 3: 훅 프로필 검증]
         → [Step 4: Q-Gate 검증] → [Step 5: 모델 라우팅 확인] → [완료: 결과 기록]
```

---

## 4. 단계별 상세 절차

### Step 1: 하네스 구성 파일 검증

**실행 조건**: 프레임워크 저장소를 최초 클론한 직후
**실행자**: DevOps 담당자
**목표**: 10개 핵심 구성 파일의 존재 및 필수 내용 확인

#### 검증 대상 파일 목록

| 번호 | 파일 경로 | 필수 확인 내용 | 검증 명령 |
|------|---------|------------|---------|
| 1 | `CLAUDE.md` | 7단계 Q-Gate 정의, 모델 라우팅 테이블, 절대 제약 7개 항목 | 아래 스크립트 참조 |
| 2 | `.claude/settings.json` | `ECC_HOOK_PROFILE: strict`, `ECC_GOVERNANCE_CAPTURE: 1` | 아래 스크립트 참조 |
| 3 | `.claude/agents/implementer.md` | `model: claude-sonnet-4-6`, 설계 기반 구현 역할 | 파일 존재 + 모델 확인 |
| 4 | `.claude/agents/reviewer.md` | `model: claude-sonnet-4-6`, 코드 품질/보안 검사 역할 (수정 불가) | 파일 존재 + 모델 확인 |
| 5 | `.claude/agents/auditor.md` | `model: claude-opus-4-6`, CSAP/N2SF/감리 준수 검증 (읽기 전용) | 파일 존재 + 모델 확인 |
| 6 | `.claude/agents/tester.md` | `model: claude-sonnet-4-6`, 테스트 케이스 작성/실행 | 파일 존재 + 모델 확인 |
| 7 | `.claude/agents/refactorer.md` | `model: claude-haiku-4-5`, Dead code 제거/구조 개선 | 파일 존재 + 모델 확인 |
| 8 | `.claude/rules/csap-compliance.md` | D-06, D-08, D-09, D-12 보안 규칙 | CSAP-D 키워드 3개 이상 |
| 9 | `.claude/rules/deadcode-policy.md` | 미사용 코드 처리 기준, 예외 목록 | 파일 존재 + 비어있지 않음 |
| 10 | `.claude/rules/harness-constraints.md` | 코딩 스타일, Git 워크플로우, 3라운드 탐색 원칙 | 파일 존재 + 비어있지 않음 |

#### 자동 검증 스크립트

```bash
#!/bin/bash
# harness-verify.sh -- CC 하네스 구성 파일 검증 스크립트
# 실행 방법: bash harness-verify.sh [프로젝트 루트 경로]

PROJECT_ROOT="${1:-.}"
PASS=0
FAIL=0
TOTAL=10

echo "=== CC 하네스 완성도 검증 ==="
echo "프로젝트: $PROJECT_ROOT"
echo ""

# 1. CLAUDE.md
if [ -f "$PROJECT_ROOT/CLAUDE.md" ] && grep -q "Q-GATE" "$PROJECT_ROOT/CLAUDE.md"; then
  echo "[PASS] CLAUDE.md -- Q-GATE 정의 존재"
  ((PASS++))
else
  echo "[FAIL] CLAUDE.md -- 파일 없음 또는 Q-GATE 정의 누락"
  ((FAIL++))
fi

# 2. settings.json
if [ -f "$PROJECT_ROOT/.claude/settings.json" ] && \
   grep -q "strict" "$PROJECT_ROOT/.claude/settings.json" && \
   grep -q "GOVERNANCE_CAPTURE" "$PROJECT_ROOT/.claude/settings.json"; then
  echo "[PASS] settings.json -- strict 프로필 + GOVERNANCE_CAPTURE 설정"
  ((PASS++))
else
  echo "[FAIL] settings.json -- 파일 없음 또는 설정 누락"
  ((FAIL++))
fi

# 3~7. 에이전트 파일
declare -A AGENTS=(
  ["implementer"]="sonnet"
  ["reviewer"]="sonnet"
  ["auditor"]="opus"
  ["tester"]="sonnet"
  ["refactorer"]="haiku"
)

for agent in "${!AGENTS[@]}"; do
  expected_model="${AGENTS[$agent]}"
  agent_file="$PROJECT_ROOT/.claude/agents/$agent.md"
  if [ -f "$agent_file" ] && grep -q "$expected_model" "$agent_file"; then
    echo "[PASS] $agent.md -- $expected_model 모델 확인"
    ((PASS++))
  else
    echo "[FAIL] $agent.md -- 파일 없음 또는 모델 불일치 (기대: $expected_model)"
    ((FAIL++))
  fi
done

# 8. csap-compliance.md
CSAP_COUNT=$(grep -c "CSAP-D" "$PROJECT_ROOT/.claude/rules/csap-compliance.md" 2>/dev/null || echo 0)
if [ "$CSAP_COUNT" -ge 3 ]; then
  echo "[PASS] csap-compliance.md -- CSAP-D 키워드 ${CSAP_COUNT}개 확인"
  ((PASS++))
else
  echo "[FAIL] csap-compliance.md -- CSAP-D 키워드 부족 (${CSAP_COUNT}개, 최소 3개 필요)"
  ((FAIL++))
fi

# 9. deadcode-policy.md
if [ -f "$PROJECT_ROOT/.claude/rules/deadcode-policy.md" ] && [ -s "$PROJECT_ROOT/.claude/rules/deadcode-policy.md" ]; then
  echo "[PASS] deadcode-policy.md -- 파일 존재 및 내용 있음"
  ((PASS++))
else
  echo "[FAIL] deadcode-policy.md -- 파일 없음 또는 비어있음"
  ((FAIL++))
fi

# 10. harness-constraints.md
if [ -f "$PROJECT_ROOT/.claude/rules/harness-constraints.md" ] && [ -s "$PROJECT_ROOT/.claude/rules/harness-constraints.md" ]; then
  echo "[PASS] harness-constraints.md -- 파일 존재 및 내용 있음"
  ((PASS++))
else
  echo "[FAIL] harness-constraints.md -- 파일 없음 또는 비어있음"
  ((FAIL++))
fi

echo ""
echo "=== 검증 결과: $PASS/$TOTAL 통과 (실패: $FAIL) ==="

if [ "$PASS" -eq "$TOTAL" ]; then
  echo "결과: 합격 -- 하네스 구성이 올바릅니다."
  exit 0
else
  echo "결과: 불합격 -- 위 FAIL 항목을 수정하세요."
  exit 1
fi
```

**완료 기준**: 10/10 통과

---

### Step 2: 5개 에이전트 동작 확인

**실행 조건**: Step 1 통과 후
**실행자**: DevOps 담당자
**목표**: 각 에이전트가 올바른 모델로 응답하는지 확인

#### 에이전트별 기동 확인 절차

| 에이전트 | 모델 | 호출 방법 | 기대 응답 확인 사항 | 실패 시 조치 |
|---------|------|---------|----------------|-----------|
| Implementer | claude-sonnet-4-6 | `@implementer "테스트: 에이전트 상태 확인"` | 설계 기반 구현 관련 응답 | `.claude/agents/implementer.md` 파일 재확인 |
| Reviewer | claude-sonnet-4-6 | `@reviewer "테스트: 에이전트 상태 확인"` | 코드 품질 검사 관련 응답 + 수정 불가 원칙 언급 | `.claude/agents/reviewer.md` 파일 재확인 |
| Auditor | claude-opus-4-6 | `@auditor "테스트: 에이전트 상태 확인"` | CSAP/N2SF 준수 관련 응답 + 읽기 전용 언급 | `.claude/agents/auditor.md` + Opus 모델 설정 확인 |
| Tester | claude-sonnet-4-6 | `@tester "테스트: 에이전트 상태 확인"` | 테스트 케이스 관련 응답 | `.claude/agents/tester.md` 파일 재확인 |
| Refactorer | claude-haiku-4-5 | `@refactorer "테스트: 에이전트 상태 확인"` | Dead code 관련 응답 | `.claude/agents/refactorer.md` + Haiku 모델 확인 |

#### Cascade 워크플로우 검증

에이전트 간 결과물이 파일로 전달되는지 확인합니다 (직접 컨텍스트 공유가 아닌 파일 기반).

```
검증 방법:
1. Implementer에게 간단한 문서 생성 요청
2. 생성된 파일을 Reviewer에게 검토 요청
3. Reviewer가 해당 파일을 읽어 검토 결과를 반환하는지 확인
4. 검토 결과 파일을 Auditor에게 감리 요청
5. 각 단계에서 파일 기반 전달이 이루어지는지 확인
```

**완료 기준**: 5개 에이전트 모두 응답 확인

---

### Step 3: strict 훅 프로필 검증

**실행 조건**: Step 2 통과 후
**실행자**: DevOps 담당자
**목표**: 보안 훅이 올바르게 동작하여 위험 명령을 차단하는지 확인

#### block-no-verify 훅 테스트

```bash
# 테스트: 이 명령은 반드시 차단되어야 합니다
# 주의: 실제로 커밋이 생성되면 안 됩니다

# 방법 1: Claude Code 세션에서 시도
# Claude에게 "git commit --no-verify -m 테스트" 명령 요청
# 기대 결과: "git 훅 우회는 감사 추적성을 위반합니다 (CSAP D-06)" 오류

# 방법 2: settings.json 훅 정의 확인
cat .claude/settings.json | grep -A5 "block-no-verify"
# 기대 결과: "no-verify" 패턴 매칭 차단 규칙 존재
```

**판정 기준**: `--no-verify` 시도 시 차단 메시지가 나타나고 커밋이 생성되지 않음

#### force-push 차단 훅 테스트

```bash
# 테스트: 이 명령도 반드시 차단되어야 합니다
# 주의: 원격 저장소에 영향이 없어야 합니다

# 방법: settings.json 훅 정의 확인
cat .claude/settings.json | grep -A5 "destructive-guard"
# 기대 결과: "force" 또는 "rm -rf" 패턴 매칭 차단 규칙 존재
```

**판정 기준**: `--force` 시도 시 차단 오류 발생

#### ECC_GOVERNANCE_CAPTURE 환경변수 확인

```bash
# settings.json에서 환경변수 설정 확인
cat .claude/settings.json | grep "ECC_GOVERNANCE_CAPTURE"
# 기대 결과: "ECC_GOVERNANCE_CAPTURE": "1"
```

#### audit.jsonl 기록 확인

```bash
# 감사 로그 파일 존재 및 최근 기록 확인
ls -la .claude/audit.jsonl
tail -5 .claude/audit.jsonl
# 기대 결과: 최근 작업 이벤트가 기록되어 있음
```

**완료 기준**: 4개 테스트 모두 통과

---

### Step 4: 7단계 Q-Gate 검증 절차

**실행 조건**: Step 3 통과 후
**실행자**: DevOps 담당자 + Auditor 에이전트
**목표**: 7단계 Q-Gate의 통과 기준과 담당 에이전트 확인

#### Q-Gate 정의 확인

| Gate | 명칭 | 담당 에이전트 | 통과 기준 | 확인 방법 |
|------|------|-----------|---------|---------|
| G1 | 요구사항 FR ID 전수 | Auditor (Opus) | 모든 산출물에 FR-X.Y ID 존재, 미매핑 0개 | `@auditor "G1: FR 매핑 전수 확인"` |
| G2 | 설계 완전성 | Auditor (Opus) | Plan + Design 문서 완비 상태에서만 구현 착수 | `@auditor "G2: Plan/Design 문서 존재 확인"` |
| G3 | 코드 품질 + AgentShield | Reviewer (Sonnet) | 102개 정적분석 규칙 전수 통과 | `@reviewer "G3: 코드 품질 검사"` |
| G4 | 테스트 커버리지 80%+ | Tester (Sonnet) | 테스트 커버리지 리포트 80% 이상 | `npm test -- --coverage` |
| G5 | OWASP Top 10 통과 | Reviewer (Sonnet) | OWASP 10개 항목 전수 통과 | `@reviewer "G5: OWASP 검사"` |
| G6 | CSAP Phase 100% | Auditor (Opus) | 해당 Phase CSAP 항목 0개 미통과 | `@auditor "G6: CSAP 커버리지"` |
| G7 | 감사 추적 완비 | Auditor (Opus) | `.claude/audit.jsonl` 필수 이벤트 전수 기록 | `wc -l .claude/audit.jsonl` |

#### Q-Gate 통과 시퀀스

```
G1 → G2 → G3 → G4 → G5 → G6 → G7

규칙:
- 순서 변경 불가
- 이전 Gate 통과 없이 다음 Gate 진입 불가
- Phase 1 완료 게이트: G1~G3 통과 필수
- Phase 2 완료 게이트: G1~G6 통과 필수
- Phase 3 완료 게이트: G1~G7 전체 통과 필수
```

#### Phase 1 Q-Gate 통과 확인 방법

현재 프로젝트가 Phase 1이므로 G1~G3을 확인합니다.

```bash
# G1 확인: Plan 문서에 정의된 FR이 산출물에 매핑되어 있는지
grep -rn "FR-" docs/framework/ --include="*.md" | head -20
# 기대 결과: FR-X.Y 형식의 ID가 산출물 파일에 존재

# G2 확인: 구현 착수 전 Plan + Design 문서 존재
ls docs/01-plan/features/*.plan.md
ls docs/02-design/features/*.design.md
# 기대 결과: plan 및 design 파일 존재

# G3 확인: 코드 품질 (현재 문서 프레임워크이므로 마크다운 lint로 대체)
# 향후 코드 구현 시: npm run lint + AgentShield 102규칙
```

**완료 기준**: Q-Gate 정의 및 확인 방법 문서화 완비

---

### Step 5: 모델 라우팅 검증

**실행 조건**: Step 4 통과 후
**실행자**: DevOps 담당자
**목표**: CLAUDE.md에 정의된 모델 라우팅 규칙이 에이전트에 올바르게 적용되는지 확인

#### 모델 라우팅 매트릭스

| 용도 | 에이전트 | 기대 모델 | 확인 명령 | 비용 등급 |
|------|---------|---------|---------|---------|
| 구현 | Implementer | claude-sonnet-4-6 | `head -4 .claude/agents/implementer.md` | 표준 |
| 리뷰 | Reviewer | claude-sonnet-4-6 | `head -4 .claude/agents/reviewer.md` | 표준 |
| 감리/규제 분석 | Auditor | claude-opus-4-6 | `head -4 .claude/agents/auditor.md` | 고비용 |
| 테스트 | Tester | claude-sonnet-4-6 | `head -4 .claude/agents/tester.md` | 표준 |
| 리팩토링/탐색 | Refactorer | claude-haiku-4-5 | `head -4 .claude/agents/refactorer.md` | 저비용 |

#### 자동 검증

```bash
# 모델 라우팅 자동 확인
echo "=== 모델 라우팅 검증 ==="
for agent in implementer reviewer auditor tester refactorer; do
  model=$(grep "^model:" .claude/agents/$agent.md | awk '{print $2}')
  echo "$agent: $model"
done
# 기대 결과:
# implementer: claude-sonnet-4-6
# reviewer: claude-sonnet-4-6
# auditor: claude-opus-4-6
# tester: claude-sonnet-4-6
# refactorer: claude-haiku-4-5
```

#### 컨텍스트 관리

```
- 50% 임계값 자동 압축: CLAUDE.md에 정의
- 수동 압축: /compact 명령 사용
- 확인 방법: 긴 세션 중 자동 압축 트리거 확인 (사용량 모니터링)
```

**완료 기준**: 5개 에이전트 모델 전수 일치

---

## 5. 체크리스트 (실행 시 사용)

### 최종 검증 요약 체크리스트

| 번호 | 검증 항목 | 통과 기준 | 결과 |
|------|---------|---------|------|
| 1 | 하네스 구성 파일 10개 존재 | 10/10 파일 존재 | [ ] 통과 / [ ] 실패 |
| 2 | CLAUDE.md Q-Gate 정의 | 7단계 Q-Gate 텍스트 존재 | [ ] 통과 / [ ] 실패 |
| 3 | settings.json strict 프로필 | `ECC_HOOK_PROFILE: strict` 확인 | [ ] 통과 / [ ] 실패 |
| 4 | settings.json GOVERNANCE_CAPTURE | `ECC_GOVERNANCE_CAPTURE: 1` 확인 | [ ] 통과 / [ ] 실패 |
| 5 | Implementer 모델: Sonnet | `model: claude-sonnet-4-6` | [ ] 통과 / [ ] 실패 |
| 6 | Reviewer 모델: Sonnet | `model: claude-sonnet-4-6` | [ ] 통과 / [ ] 실패 |
| 7 | Auditor 모델: Opus | `model: claude-opus-4-6` | [ ] 통과 / [ ] 실패 |
| 8 | Tester 모델: Sonnet | `model: claude-sonnet-4-6` | [ ] 통과 / [ ] 실패 |
| 9 | Refactorer 모델: Haiku | `model: claude-haiku-4-5` | [ ] 통과 / [ ] 실패 |
| 10 | block-no-verify 훅 동작 | `--no-verify` 차단 확인 | [ ] 통과 / [ ] 실패 |
| 11 | force-push 차단 훅 동작 | `--force` 차단 확인 | [ ] 통과 / [ ] 실패 |
| 12 | audit.jsonl 기록 | 최근 이벤트 기록 존재 | [ ] 통과 / [ ] 실패 |
| 13 | Q-Gate G1~G3 통과 | Phase 1 완료 게이트 | [ ] 통과 / [ ] 실패 |
| 14 | 에이전트 5개 기동 응답 | 각 에이전트 응답 확인 | [ ] 통과 / [ ] 실패 |
| 15 | Cascade 워크플로우 | 파일 기반 전달 확인 | [ ] 통과 / [ ] 실패 |

**합격 기준**: 15/15 통과 (13개 이상 시 조건부 합격, 보완 조치 후 재검증)

---

## 6. 이력 관리

검증 실행 시 다음 정보를 `.claude/audit.jsonl`에 기록합니다:

```json
{
  "timestamp": "2026-04-05T14:00:00Z",
  "actor": "devops",
  "action": "HARNESS_VERIFICATION",
  "result": "pass",
  "score": "15/15",
  "phase": "Phase 1 Foundation"
}
```

---

## 7. 관련 문서 참조

| 문서 | 역할 |
|------|------|
| `CLAUDE.md` | 하네스 핵심 정의 (Q-Gate, 모델 라우팅, 절대 제약) |
| `.claude/settings.json` | 훅 프로필 및 환경변수 설정 |
| `.claude/agents/*.md` | 5개 에이전트 역할 및 모델 정의 |
| `.claude/rules/*.md` | CSAP/Dead code/코딩 스타일 규칙 |
| `.claude/audit.jsonl` | 감사 로그 (append-only) |

---

## 8. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 -- 5단계 검증 절차 + 15항목 체크리스트. 현행 하네스 실측 기반 | Claude Code (PM Lead) |
