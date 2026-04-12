# SVC-AI-ADV-R201 Plan — AI기반 코드 취약점 자동 패치

## Executive Summary

| 관점 | 내용 |
|------|------|
| WHY | CVE 취약점 패키지 자동 패치로 공급망 보안 강화 |
| WHO | 보안팀, 개발팀 |
| RISK | 메이저 버전 변경 시 호환성 파괴 위험 |
| SUCCESS | SC01: 동일 메이저 버전 AUTO 패치, SC02: 메이저 변경 MANUAL 분류 |
| SCOPE | CVE 등록 → 패치 제안 → 패치 적용 → 결과 기록 |

## 요구사항

- FR-R201.1: CodeVuln 등록
- FR-R201.2: 메이저 버전 변경 여부 기반 전략 결정 (AUTO/SEMI_AUTO/MANUAL)
- FR-R201.3: AUTO 전략 → APPLIED, MANUAL → PENDING
- FR-R201.4: 미패치 취약점 목록 조회
- FR-R201.5: CSAP D-06 감사 로그 전수 기록

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 최초 작성 | ai-impl-a |
