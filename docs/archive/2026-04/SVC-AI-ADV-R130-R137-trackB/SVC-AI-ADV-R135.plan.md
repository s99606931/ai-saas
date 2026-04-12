# SVC-AI-ADV-R135 — AI 기반 계약 자동화 엔진

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: Implementer (트랙 B 2차)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 표준 계약 조항 자동 생성 + 리스크 조항 탐지 |
| 품질 | 조항 템플릿 기반 생성, 리스크 패턴 매칭 |
| 보안 | 계약 내용 내부 처리, 민감 조항 식별 |
| 비용 | 템플릿 + 패턴 기반, LLM 없음 |

## Context Anchor

- **WHY**: 공공기관 계약 초안 작성에 법무팀 검토 병목 발생. 표준 조항 자동화로 검토 시간 단축.
- **WHO**: 계약 담당자, 법무팀
- **RISK**: 리스크 조항 미탐지로 불리한 계약 체결
- **SUCCESS**: 계약 유형 선택 → 조항 생성 → 리스크 탐지 → 계약서 초안 반환
- **SCOPE**: In — 표준 조항 템플릿, 리스크 패턴 탐지. Out — 법적 효력 보장.

## 요구사항

- **FR-R135.1**: `registerClauseTemplate(template)` — 계약 조항 템플릿 등록
- **FR-R135.2**: `generateContract(type, variables)` — 계약서 초안 생성
- **FR-R135.3**: `detectRiskClauses(contractText)` — 리스크 조항 탐지
- **FR-R135.4**: `addRiskPattern(pattern)` — 리스크 패턴 등록
- **FR-R135.5**: `getAuditLog()` — 생성/분석 이력 (CSAP D-06)
- **NFR-R135.1**: TypeScript strict 0 에러, 테스트 6개+

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 최초 작성 | Implementer |
