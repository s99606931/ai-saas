# 감리 완료 체크리스트

> MTU-A3c | FR-4.6 | 행안부 감리기준 고시 제2023-1호 §10
> 적용 기준일: 2026-04-05

---

## 1. 감리 완료 기준 7개 항목

| 번호 | 항목 | 확인 내용 | 확인자 | 결과 | 비고 |
|------|------|---------|--------|------|------|
| CL-01 | T01~T07 산출물 전수 완비 | 7개 산출물 모두 존재 + 필수 섹션 완비 확인 | 감리관 | [ ] | 산출물 목록 참조 |
| CL-02 | FR 추적성 100% | T04 매트��스 — 모든 FR이 산출물·테스트·CSAP와 매핑 완료 | 감리관 | [ ] | Q-GATE G1 |
| CL-03 | CSAP 해당 Phase 100% | Auditor 에이전트 검증 + Q-Gate G6 통과 | 감리관 | [ ] | CSAP 79항목 |
| CL-04 | 테스트 커버리지 80% 이상 | Tester 에이전트 보고서 + Q-Gate G4 통과 | 품질 담당 | [ ] | coverage-summary |
| CL-05 | 결함 처리 완료 | T07 결함관리대장 CRITICAL/HIGH 미결 0건 | 품질 담당 | [ ] | DEF 종결률 |
| CL-06 | 감사 로그 완비 | audit.jsonl 민감 작업 전수 기록 확인 | 보안 담당 | [ ] | Q-GATE G7 |
| CL-07 | OWASP Top 10 통과 | Reviewer 에이전트 Q-Gate G5 통과 | 보안 담당 | [ ] | Trivy + ZAP |

**전체 체크리스트 통과 기준**: 7개 항목 전수 [ ] --> [v] 전환

---

## 2. 산출물 파일 경로 참조

| 산출물 | 파일 경로 | 존재 확인 |
|--------|---------|:---------:|
| T01 사업계획서 | `docs/framework/06-audit-compliance/templates/T01-business-plan.md` | [ ] |
| T02 요구사항정의서 | `docs/framework/06-audit-compliance/templates/T02-requirements.md` | [ ] |
| T03 상세설계서 | `docs/framework/06-audit-compliance/templates/T03-detailed-design.md` | [ ] |
| T04 추적성 매트릭스 | `docs/framework/06-audit-compliance/templates/T04-traceability-matrix.md` | [ ] |
| T05 시험계획서 | `docs/framework/06-audit-compliance/templates/T05-test-plan.md` | [ ] |
| T06 시험결과서 | `docs/framework/06-audit-compliance/templates/T06-test-result.md` | [ ] |
| T07 결함관리대장 | `docs/framework/06-audit-compliance/templates/T07-defect-management.md` | [ ] |

---

## 3. Q-GATE 통과 현황

| Q-Gate | 검증 내용 | 검증 에이전트 | 통과 여부 | 비고 |
|--------|---------|-----------|:---------:|------|
| G1 | 요구사항 FR ID 전수 | Auditor | [ ] | |
| G2 | 설계 완전성 | Auditor | [ ] | |
| G3 | 코드 품질 + AgentShield 102규칙 | Reviewer | [ ] | |
| G4 | 테스트 커버리지 80%+ | Tester | [ ] | |
| G5 | OWASP Top10 통과 | Reviewer | [ ] | |
| G6 | CSAP 해당 Phase 100% | Auditor | [ ] | |
| G7 | 감사 추적 audit.jsonl 완비 | Auditor | [ ] | |

---

## 4. 최종 판정

| 판정 | 조건 | 결과 |
|------|------|------|
| 통과 | CL-01~CL-07 전수 통과 | [ ] |
| 조건부 통과 | CL-05 MEDIUM 이하 미결 존재, 나머지 통과 | [ ] |
| 불통과 | CL-01~CL-07 중 1개 이상 불통과 | [ ] |

**판정일**: {YYYY-MM-DD}
**판정자**: {감리관 성명}
**서명**: _______________

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | MTU-A3c Do — 감리 완료 체크리스트 7항목 작성 | Implementer Agent |
