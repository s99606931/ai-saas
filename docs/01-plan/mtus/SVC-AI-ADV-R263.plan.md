# SVC-AI-ADV-R263 — 규정 의사결정 엔진

> 작성일: 2026-04-13 | 버전: 1.0.0 | 작성자: PM Lead (자율 생성)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 규정 규칙 등록 + 케이스 입력 → 자동 적용 판단 + 근거 인용 + 충돌 감지 |
| 품질 | 결정론적 규칙 매칭, 테스트 12개+ |
| 보안 | C/S 차단, caseId 마스킹, CSAP D-06 감사 로그 |
| 비용 | 로컬 규칙 엔진 |

## Context Anchor

- **WHY**: 공공기관 복잡 규정 수작업 해석 → 오류·지연 → AI 자동화 필요
- **WHO**: 법무팀, 민원 담당자, 조례 검토 부서
- **RISK**: 잘못된 규정 적용 → 행정 오류
- **SUCCESS**: 규칙 등록 → 케이스 제출 → 해당 규정 반환 + 근거 + 판정
- **SCOPE**: In — 규칙 엔진. Out — 자연어 처리/LLM 호출

## 요구사항

- **FR-R263.1**: 규정 등록 (ruleId·title·category·conditions·effect·priority·source)
- **FR-R263.2**: 조건 정의 (field·op·value), op: EQ, NEQ, GT, LT, GTE, LTE, IN, CONTAINS
- **FR-R263.3**: 케이스 평가 (case 입력 → 매칭 규정 목록 + 결과)
  - 매칭: 모든 conditions 만족
  - 우선순위: priority 높은 규정 우선
- **FR-R263.4**: 결정 생성 (decision: APPROVE/DENY/REVIEW, appliedRules[], rationale[])
- **FR-R263.5**: 충돌 감지 (동일 조건 but 다른 effect → CONFLICT 반환)
- **FR-R263.6**: 규정 목록 조회 (category 필터)
- **FR-R263.7**: C/S 차단, caseId 마스킹, CSAP D-06 감사 로그, getAuditLog()
- **NFR-R263.1**: TypeScript strict, 테스트 12개+

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R263.1~7 | regulation-decision-engine.ts | .test.ts | D-06, D-12 |
