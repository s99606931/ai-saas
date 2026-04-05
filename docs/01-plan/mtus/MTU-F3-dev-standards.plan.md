# MTU-F3: 개발 표준 가이드

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-F3 |
| Phase | Phase 1 Foundation |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| FR 매핑 | FR-0.6, FR-0.7, FR-0.8 |
| 의존 MTU | MTU-F2 |
| 예상 세션 | 1 세션 |

---

## 목적

프레임워크 산출물 작성자(개발자·PM·감리 담당자)가 일관된 품질의 문서와 코드를 생산할 수 있도록 표준을 정의합니다. 6가지 문서 유형 템플릿, 요구사항 ID 체계, 코딩 스타일, 리뷰 절차를 단일 파일 세트로 제공합니다.

**감리 연결**: 행안부 감리기준 고시 제2023-1호에서 요구하는 문서 형식 표준화로 1차 감리 통과율 향상이 목적입니다.

---

## 산출물 파일 (4개)

| 파일 | 문서 유형 | 핵심 내용 |
|------|---------|---------|
| `01-dev-standards/doc-type-templates.md` | 구현 가이드형 | 6가지 문서 유형별 템플릿 및 작성 지침 |
| `01-dev-standards/requirement-id-system.md` | 참조형 | 요구사항 ID 체계 (FR/NFR/INFR/AI-REQ/CC-REQ) |
| `01-dev-standards/coding-style-guide.md` | 구현 가이드형 | TypeScript/Python 코딩 스타일 + 보안 패턴 |
| `01-dev-standards/review-checklist.md` | 체크리스트형 | PR 코드리뷰 + 문서 리뷰 체크리스트 |

---

## 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|----|---------|---------|
| FR-0.6 | 6개 문서 유형 템플릿 완비 | 각 유형별 빈 템플릿 + 작성 예시 존재 |
| FR-0.7 | 요구사항 ID 체계 명시 | FR/NFR/INFR/AI-REQ/CC-REQ 5종 패턴 정의 |
| FR-0.8 | 리뷰 체크리스트 실용성 | 체크리스트만으로 코드리뷰 1회 수행 가능 |

---

## 핵심 설계 내용

### doc-type-templates.md 구성

6가지 문서 유형 템플릿을 정의합니다.

#### 유형 1: 체크리스트형 (Checklist)

적용 파일: `checklist-simple.md`, `review-checklist.md`, `isms-p-checklist.md`

```markdown
# [문서명]

## 메타데이터
| 항목 | 내용 |
|------|------|
| 문서 ID | [예: CHK-001] |
| 버전 | [예: 1.0.0] |
| 작성일 | [YYYY-MM-DD] |
| CSAP 연관 항목 | [예: CSAP-D08-03] |

## 목적
[체크리스트 사용 목적, 대상 독자, 사용 시나리오]

## 체크리스트

| # | 항목 | 확인 | 비고 |
|---|------|------|------|
| 1 | [항목 설명] | ☐ | [근거 규정] |

## 합격 기준
[전수 통과 조건]

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
```

#### 유형 2: 구현 가이드형 (Implementation Guide)

적용 파일: `k3s-setup-recipe.md`, `api-gateway-guide.md`, `cicd-pipeline-guide.md`

```markdown
# [문서명] 구현 가이드

## 메타데이터
[FR 매핑, CSAP 관련 항목, 사전 요건]

## 목적
[구현 목표, 완료 기준]

## 사전 요건
[필수 설치 소프트웨어, 접근 권한]

## 단계별 구현 절차

### 단계 1: [단계명]
\`\`\`bash
# 실행 명령
\`\`\`

> **주의**: [CSAP/N2SF 보안 고려사항]

## 검증 방법
[구현 완료 확인 명령 또는 절차]

## 트러블슈팅
[주요 오류 및 해결 방법]

## 변경 이력
```

#### 유형 3: 절차서형 (Procedure)

적용 파일: `incident-response-procedure.md`, `audit-procedure.md`

```markdown
# [문서명] 절차서

## 메타데이터
[담당 부서, 승인자, 검토 주기]

## 목적 및 적용 범위

## 역할 및 책임
| 역할 | 책임 | 담당자 |

## 절차

### P01. [절차명]
- **조건**: [시작 조건]
- **단계**:
  1. [구체적 행동]
- **완료 기준**: [확인 방법]

## 비상 연락처

## 변경 이력
```

#### 유형 4: 아키텍처 레퍼런스형 (Architecture Reference)

적용 파일: `n2sf-reference-architecture.md`, `infra-overview.md`

```markdown
# [시스템명] 아키텍처 레퍼런스

## 메타데이터
[버전, N2SF 등급, CSAP 연관 항목]

## Executive Summary
| 항목 | 내용 |
(4-Perspective 테이블: 기능/보안/성능/운영)

## 아키텍처 개요
[Mermaid 다이어그램 또는 ASCII 도식]

## 구성 요소 설명

## 보안 고려사항
[CSAP-DXX-YY 항목별 설계 결정 근거]

## 의사결정 로그 (ADR)
| ID | 결정 내용 | 근거 | 일자 |

## 변경 이력
```

#### 유형 5: 감리 템플릿형 (Audit Template)

적용 파일: `T01-business-plan.md`, `T02-requirements.md`, `T03-architecture.md`

```markdown
# T[번호] [문서명]

## 감리 메타데이터
| 항목 | 내용 |
|------|------|
| 문서 유형 | 감리 산출물 T[번호] |
| 감리 기준 | 행안부 고시 제2023-1호 제[X]조 |
| 감리관 확인란 | ☐ 적합 / ☐ 조건부 적합 / ☐ 부적합 |
| 결함 번호 | [감리 시 기입] |

## [필수 섹션 - 감리기준에 따라 가변]

## 변경 이력
```

#### 유형 6: 매핑 테이블형 (Mapping Table)

적용 파일: `checklist-master.md`, `csap-to-n2sf-mapping.md`, `traceability-matrix.md`

```markdown
# [문서명] 매핑 테이블

## 메타데이터
[추적성 방향, 버전, 매핑 완결 기준]

## 매핑 원칙
[공백(미매핑) = 결함 처리 규칙]

## 매핑 테이블

| 출발 ID | 출발 항목명 | 도착 ID | 도착 항목명 | 매핑 유형 | 비고 |
|---------|-----------|--------|-----------|---------|------|

## 미매핑 항목 목록
[공백 매핑 존재 시 사유 기술]

## 변경 이력
```

### requirement-id-system.md 구성

요구사항 ID 체계를 규정하고 네이밍 규칙, 예시, 활용 방법을 정의합니다.

| ID 유형 | 패턴 | 예시 | 적용 범위 |
|---------|------|------|---------|
| 기능 요구사항 | `FR-{모듈}.{번호}` | FR-1.1, FR-2.3 | 시스템 기능 요건 |
| 비기능 요구사항 | `NFR-{번호}` | NFR-1, NFR-12 | 성능·보안·가용성 요건 |
| 인프라 요구사항 | `INFR-{번호}` | INFR-1, INFR-5 | 하드웨어·네트워크·클라우드 요건 |
| AI 연동 요구사항 | `AI-REQ-{번호}` | AI-REQ-1, AI-REQ-3 | AI/LLM API 관련 요건 |
| CC 하네스 요구사항 | `CC-REQ-{번호}` | CC-REQ-1, CC-REQ-2 | Claude Code 하네스 관련 요건 |

**모듈 번호 체계**:
- 모듈 0: Foundation (MTU-F1~F6)
- 모듈 1: CSAP 표준등급 (MTU-C1~C3)
- 모듈 2: N2SF (MTU-C4~C5)
- 모듈 3: Infrastructure (MTU-I1~I5)
- 모듈 4: AI Integration (MTU-A1~A2)
- 모듈 5: Audit Compliance (MTU-F5, MTU-A3a~c, MTU-A4)

### coding-style-guide.md 구성

CLAUDE.md 및 `.claude/rules/harness-constraints.md` 기반 코딩 스타일 규칙과 CSAP 보안 패턴을 통합하여 정의합니다.

**핵심 섹션**:
1. 들여쓰기·네이밍·함수 크기 규칙 (harness-constraints.md 섹션 1)
2. Dead Code 금지 규칙 (deadcode-policy.md 처리 기준)
3. CSAP D-12 보안 패턴 (Zod 검증, 매개변수화 쿼리, DOMPurify)
4. CSAP D-06 감사 로그 패턴
5. CSAP D-09 암호화 패턴
6. 하드코딩 시크릿 금지 규칙

### review-checklist.md 구성

PR 리뷰 및 문서 리뷰를 위한 체크리스트를 제공합니다.

**코드 리뷰 섹션** (Q-GATE G3, G5 대응):
- [ ] 하드코딩된 시크릿(API 키, 비밀번호) 없음
- [ ] 모든 API 엔드포인트 RBAC 검사 적용
- [ ] 입력 검증 (Zod 스키마 또는 동등한 라이브러리) 적용
- [ ] SQL/NoSQL 인젝션 방지 (매개변수화 쿼리) 적용
- [ ] 에러 메시지에 민감 정보 미포함
- [ ] 감사 로그 대상 작업에 `auditLog()` 호출 존재
- [ ] Dead code 없음 (미사용 함수·변수·import)
- [ ] 함수 크기 80줄 이하, 단일 책임 원칙
- [ ] OWASP Top 10 항목 체크

**문서 리뷰 섹션** (Q-GATE G1, G2 대응):
- [ ] 메타데이터 테이블 (MTU ID, Phase, FR 매핑) 완비
- [ ] 요구사항 ID 체계 (FR-X.X, NFR-X) 준수
- [ ] 합격 기준 (번호 목록) 존재
- [ ] 변경 이력 섹션 존재
- [ ] 한국어 전용, 공공기관 표준 용어 사용
- [ ] CSAP/N2SF 관련 조항 교차 참조 명시

---

## 합격 기준 (Acceptance Criteria)

1. 6가지 문서 유형 템플릿 전수 작성 (각 유형에 빈 템플릿 + 작성 예시 1개 이상)
2. 요구사항 ID 체계 5종 (FR/NFR/INFR/AI-REQ/CC-REQ) 정의 및 예시 완비
3. 모듈 번호 체계 6개 (모듈 0~5) 정의
4. 코딩 스타일 규칙 harness-constraints.md와 충돌 없음
5. 리뷰 체크리스트만으로 코드리뷰 1회 수행 가능 (다른 문서 미참조)
6. 모든 파일에 변경 이력 섹션 존재

---

## 테스트 시나리오

**TS-F3-01**: 신규 개발자가 review-checklist.md만 참조하여 PR 리뷰를 15분 이내 완료

**TS-F3-02**: 문서 작성자가 doc-type-templates.md를 보고 올바른 유형의 빈 템플릿을 3분 이내 선택

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 — 6개 문서 유형 템플릿 + 요구사항 ID 체계 설계 | Claude Code |
