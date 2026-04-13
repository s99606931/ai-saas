# SVC-AI-ADV-R397 Plan: Social Media Monitor AI

## Context Anchor
- **WHY**: 소셜미디어 민원/위기 조기 탐지로 선제적 대응
- **WHO**: 홍보팀, 위기대응팀
- **RISK**: 위기 징후 놓칠 시 여론 악화
- **SUCCESS**: SC-R397-1 감정 점수/카테고리, SC-R397-2 알림 레벨
- **SCOPE**: 포스트 분석, 집계 알림

## 요구사항
- FR-R397.1: 키워드 기반 감정 점수 계산 (-100~100)
- FR-R397.2: crisis/complaint/positive/neutral 분류
- FR-R397.3: alertLevel (low/med/high)
- FR-R397.4: N2SF C/S 등급 차단
- FR-R397.5: CSAP D-06 감사 로그

## 성공 기준 (SC)
- SVC-AI-ADV-R397-SC01: 테스트 5개+ 통과
- SVC-AI-ADV-R397-SC02: TypeScript strict 0 오류

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-13 | 최초 작성 | ai-impl-b |
