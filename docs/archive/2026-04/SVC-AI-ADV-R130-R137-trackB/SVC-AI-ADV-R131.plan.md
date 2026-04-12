# SVC-AI-ADV-R131 — AI 기반 정책 효과 분석기

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: Implementer (트랙 B 2차)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 정책 시행 전/후 데이터 분석 → 효과 자동 측정 (차분분석) |
| 품질 | 통계적 유의성 검정, 효과 크기 계산 |
| 보안 | 공개 정책 지표만 처리, PII 없음 |
| 비용 | 순수 통계 계산, LLM 없음 |

## Context Anchor

- **WHY**: 공공정책 효과를 객관적으로 측정하는 수단 부재. 감사·국정감사 자료로 활용 가능.
- **WHO**: 정책 담당자, 감사관, 의회 보좌관
- **RISK**: 혼동 변수 미통제로 인한 오분석
- **SUCCESS**: 정책 등록 → 전후 데이터 입력 → 효과 측정 → 보고서 반환
- **SCOPE**: In — 전후 비교, 차분분석, 효과 크기. Out — 인과 추론 모델.

## 요구사항

- **FR-R131.1**: `registerPolicy(policy)` — 정책 등록 (시행일 포함)
- **FR-R131.2**: `addMetric(policyId, phase, value, date)` — 전/후 지표 기록
- **FR-R131.3**: `analyzeEffect(policyId)` — 전후 차이 + 효과 크기 (Cohen's d) 계산
- **FR-R131.4**: `generateReport(policyId)` — 효과 분석 보고서 반환
- **FR-R131.5**: `getAuditLog()` — 분석 이력 (CSAP D-06)
- **NFR-R131.1**: TypeScript strict 0 에러, 테스트 6개+

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 최초 작성 | Implementer |
