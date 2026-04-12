# MTU-N115: OpenSSF Scorecard CI 자동화

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | CI 파이프라인 보안 점수 자동 측정, 점수 저하 시 PR 차단, 보안 개선 제안 자동 생성 |
| 기술 | Gitea Actions 워크플로우 + scorecard-action + PR 코멘트 자동화 |
| 보안 | CSAP D-05 공급망 보안 자동 검증, 최소 점수 미달 시 머지 차단 |
| 운영 | 주간 스케줄 스캔 + PR 트리거 스캔 이중 체계 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N115.1 | Gitea Actions 워크플로우로 PR 시 Scorecard 자동 실행 | HIGH |
| FR-N115.2 | 최소 점수 미달 시 PR 머지 차단 (스크립트) | HIGH |
| FR-N115.3 | Scorecard 결과 PR 코멘트 자동 게시 | MED |
| FR-N115.4 | 보안 개선 제안 자동 생성 (항목별 가이드) | MED |
| FR-N115.5 | SARIF 리포트 생성 및 보존 | MED |
| FR-N115.6 | E2E 테스트: 워크플로우 구문 + 스크립트 동작 검증 | HIGH |
