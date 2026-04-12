# SVC-AI-ADV-R177 Plan — AI기반 사용자 행동 이상 탐지

## Executive Summary

| 관점 | 내용 |
|------|------|
| WHY | 공공 SaaS 내부자 위협 및 계정 탈취 조기 탐지 |
| WHO | 보안팀, 감사팀 |
| RISK | 정상 사용자 오탐(false positive) 가능성 |
| SUCCESS | SC01: EXCESSIVE_REQUESTS/CREDENTIAL_STUFFING/BULK_EXPORT/UNUSUAL_TIME 탐지 |
| SCOPE | 이벤트 기록 → 베이스라인 등록 → 이상 탐지 → 감사 로그 |

## 요구사항

- FR-R177.1: 사용자 이벤트 기록
- FR-R177.2: 베이스라인 등록 (정상 패턴)
- FR-R177.3: 과도한 요청/자격증명 스터핑/대량 내보내기/비정상 시간 탐지
- FR-R177.4: 이상 유형별 심각도 분류
- FR-R177.5: CSAP D-06 감사 로그 전수 기록

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 최초 작성 | ai-impl-a |
