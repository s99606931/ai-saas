# SVC-AI-ADV-R153 — 공공기관 조직 온보딩 AI

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: Implementer (트랙 B 3차)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 새 조직/부서 SaaS 도입 시 자동 환경 설정 가이드 생성 |
| 품질 | 조직 유형별 맞춤 온보딩 스텝, 진행률 추적 |
| 보안 | 조직 정보 내부 처리, C/S 등급 차단 |
| 비용 | 규칙 기반 가이드 생성, LLM 없음 |

## Context Anchor

- **WHY**: 공공기관 신규 SaaS 도입 시 환경 설정 안내가 비표준화되어 있어 도입 기간 과다.
- **WHO**: IT 담당자, 시스템 관리자
- **RISK**: 설정 누락으로 보안 취약점 발생
- **SUCCESS**: 조직 등록 → 온보딩 스텝 생성 → 진행 추적 → 완료 보고서 반환
- **SCOPE**: In — 스텝 생성, 진행 추적, 보고서. Out — 실제 시스템 설정 자동화.

## 요구사항

- **FR-R153.1**: `registerOrg(org)` — 조직 등록 (유형: central/local/public-institution)
- **FR-R153.2**: `generateOnboardingPlan(orgId)` — 온보딩 스텝 자동 생성
- **FR-R153.3**: `completeStep(orgId, stepId)` — 스텝 완료 처리
- **FR-R153.4**: `getProgress(orgId)` — 진행률 + 다음 스텝 반환
- **FR-R153.5**: `getAuditLog()` — 온보딩 이력 (CSAP D-06)
- **NFR-R153.1**: TypeScript strict 0 에러, 테스트 5개+

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 최초 작성 | Implementer |
