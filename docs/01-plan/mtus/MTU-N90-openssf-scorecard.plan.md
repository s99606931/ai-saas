# MTU-N90: OpenSSF Scorecard 보안 점수카드 자동화 — Plan

> **MTU ID**: MTU-N90
> **Phase**: 7라운드 CI/CD·DevOps 고도화
> **작성일**: 2026-04-10

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 오픈소스 보안 성숙도 자동 측정, CSAP D-05 공급망 보안 강화 |
| 기술 | OpenSSF Scorecard CI 통합 + 보안 점수 대시보드 + Gitea Webhook |
| 보안 | 18개 보안 검사 자동화 (코드리뷰, 의존성, 서명, SAST 등) |
| 운영 | 주간 자동 스캔 + 점수 하락 시 알림 + 개선 PR 자동 생성 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | S2C2F Level 3 + SLSA Level 3 보유하나, 전체 보안 성숙도를 단일 점수로 가시화 필요 |
| WHO | CISO, 보안 담당, 감리관 |
| RISK | 보안 점수 미측정 시 개선 방향 불명, 공급망 취약점 잠재 |
| SUCCESS | Scorecard 점수 7.0+ 달성, 18개 검사 중 15개+ PASS |
| SCOPE | Scorecard CLI 설치 + CI 통합 + 결과 파싱 + 대시보드 + 알림 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N90.1 | OpenSSF Scorecard CLI 설치 및 설정 | HIGH |
| FR-N90.2 | Gitea Actions 워크플로우 통합 (주간 스캔) | HIGH |
| FR-N90.3 | 점수 결과 JSON 파싱 + 이력 관리 | MED |
| FR-N90.4 | 보안 점수 대시보드 (Grafana 패널) | MED |
| FR-N90.5 | 점수 하락 시 알림 + 개선 권장사항 자동 생성 | MED |
| FR-N90.6 | E2E 테스트 (스캔 실행 + 결과 검증) | HIGH |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Scorecard 워크플로우 | .gitea/workflows/scorecard.yaml |
| 2 | 점수 파싱 스크립트 | scripts/scorecard-parse.sh |
| 3 | 보안 점수 설정 | infra/security/scorecard/config.yaml |
| 4 | E2E 테스트 | tests/e2e/test-scorecard.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 작성 | PM Agent |
