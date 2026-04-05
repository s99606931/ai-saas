# MTU-F3: 개발 표준 가이드 Design 문서

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-F3 |
| Phase | Phase 1 Foundation |
| 버전 | 0.1.0 |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| 작성자 | PM Lead Agent (Claude Code) |
| 관련 Plan | docs/01-plan/mtus/MTU-F3-dev-standards.plan.md |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 일관된 품질의 문서/코드 생산을 위해 표준 필수. 감리기준 문서 형식 표준화로 1차 감리 통과율 향상 |
| **WHO** | 개발자, PM/기획자, 감리 담당자, 문서 작성자 전원 |
| **RISK** | 문서 유형 혼동, ID 체계 불일치, 리뷰 체크리스트 미활용 시 품질 저하 |
| **SUCCESS** | 6가지 문서 유형 전수, 5종 ID 체계, 리뷰 체크리스트 단독 사용 가능 |
| **SCOPE** | `01-dev-standards/` 디렉토리 4개 파일 |

---

## 1. 설계 개요

4개 파일이 서로 참조하며 통합 개발 표준을 구성합니다:

```
doc-type-templates.md    ← 문서 작성 시 유형 선택 기준
requirement-id-system.md ← ID 체계 정의 (모든 문서에서 참조)
coding-style-guide.md    ← 코드 작성 규칙 + CSAP 보안 패턴
review-checklist.md      ← 위 3개를 기반으로 한 검증 도구
```

---

## 2. 파일별 설계

### 2.1 doc-type-templates.md
6가지 문서 유형별 빈 템플릿 + 적용 파일 예시 + 작성 지침

### 2.2 requirement-id-system.md
5종 ID 체계 + 모듈 번호 체계 + 네이밍 규칙 + 활용 예시

### 2.3 coding-style-guide.md
harness-constraints.md 기반 코딩 규칙 + CSAP D-12/D-06/D-09 보안 패턴

### 2.4 review-checklist.md
코드 리뷰(Q-GATE G3/G5) + 문서 리뷰(Q-GATE G1/G2) 체크리스트

---

## 3. 구현 순서

1. `01-dev-standards/doc-type-templates.md`
2. `01-dev-standards/requirement-id-system.md`
3. `01-dev-standards/coding-style-guide.md`
4. `01-dev-standards/review-checklist.md`

---

## 4. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 -- 4개 파일 구조 + 상호 참조 관계 설계 | PM Lead Agent |
