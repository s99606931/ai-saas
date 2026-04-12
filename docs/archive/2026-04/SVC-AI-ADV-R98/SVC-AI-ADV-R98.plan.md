# SVC-AI-ADV-R98 — AI 온보딩 엔진 (사용자 맞춤 튜토리얼)

> 작성일: 2026-04-12 | 버전: 1.0.0

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 사용자 유형 + 사용 패턴 기반 맞춤형 가이드 스텝 생성 |
| 품질 | 스텝 완료율 추적, 미완료 재안내 |
| 보안 | 사용자 행동 로그는 O등급 익명화 |
| 비용 | 규칙 + 템플릿 기반, LLM은 요약용 옵션 |

## Context Anchor

- **WHY**: 기존 tenant-onboarding은 테넌트 수준. 개인 사용자 스텝 가이드 필요
- **WHO**: 공공 포털 신규 사용자
- **SUCCESS**: userRole별 추천 스텝 목록 + 완료 상태 + 다음 스텝 반환
- **SCOPE**: 개인 사용자 단위 엔진 (테넌트용과 독립)

## 요구사항

- **FR-R98.1**: registerTemplate(userRole, steps[])
- **FR-R98.2**: startOnboarding(userId, userRole) — 진행 상태 생성
- **FR-R98.3**: completeStep(userId, stepId)
- **FR-R98.4**: getNextStep(userId) — 미완료 최우선 반환
- **FR-R98.5**: progressReport(userId) — 완료율/소요시간
- **NFR-R98.1**: 테스트 5개+
