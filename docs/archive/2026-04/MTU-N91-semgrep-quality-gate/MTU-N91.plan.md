# MTU-N91: Semgrep 코드 품질 게이트 + 기술 부채 측정 — Plan

> **MTU ID**: MTU-N91
> **Phase**: 7라운드 CI/CD·DevOps 고도화
> **작성일**: 2026-04-10

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 코드 품질 자동 게이트, 기술 부채 가시화, 감리 Q-Gate G3 강화 |
| 기술 | Semgrep SAST + 커스텀 규칙 (CSAP/공공기관) + 기술 부채 메트릭 |
| 보안 | OWASP Top 10 + CSAP D-12 시스템 개발 보안 자동 검증 |
| 운영 | PR 단위 자동 스캔 + 기술 부채 트렌드 대시보드 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | ESLint 만으로는 보안 취약점 탐지 한계, SAST 전용 도구 필요 |
| WHO | 개발팀, 보안 담당, 감리관 |
| RISK | 보안 취약점 미탐지, 기술 부채 누적, 감리 G3/G5 불통과 |
| SUCCESS | PR 차단 규칙 0건 통과, 기술 부채 점수 측정 + 트렌드 |
| SCOPE | Semgrep CI 통합, 공공기관 커스텀 규칙, 기술 부채 계산기 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N91.1 | Semgrep CI 워크플로우 통합 (PR 트리거) | HIGH |
| FR-N91.2 | 공공기관 SaaS 커스텀 Semgrep 규칙 (15개+) | HIGH |
| FR-N91.3 | 기술 부채 측정 스크립트 (복잡도+중복+미사용) | MED |
| FR-N91.4 | 품질 게이트 실패 시 PR 차단 | HIGH |
| FR-N91.5 | E2E 테스트 | HIGH |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Semgrep 워크플로우 | .gitea/workflows/semgrep.yaml |
| 2 | 공공기관 커스텀 규칙 | infra/security/semgrep/rules/ |
| 3 | 기술 부채 측정 스크립트 | scripts/tech-debt-measure.sh |
| 4 | E2E 테스트 | tests/e2e/test-semgrep.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 작성 | PM Agent |
