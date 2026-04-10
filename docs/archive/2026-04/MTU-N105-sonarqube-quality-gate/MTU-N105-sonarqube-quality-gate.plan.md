# MTU-N105: SonarQube 경량 코드 품질 게이트 — Plan

> **MTU ID**: MTU-N105
> **Phase**: 9라운드 CI/CD DevOps 고도화
> **작성일**: 2026-04-10
> **복잡도**: MED

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 코드 품질 정량 관리, 기술 부채 가시화, 감리 증빙 자동화 |
| 기술 | SonarQube CE k3s 배포 + Gitea Actions CI 연동 + 품질 게이트 |
| 보안 | CSAP D-12 시스템 개발 보안 + OWASP Top 10 코드 패턴 탐지 |
| 운영 | PR 단위 자동 스캔 + 품질 게이트 실패 시 머지 차단 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | Semgrep(N91)은 SAST 전용. 종합 코드 품질 관리 도구 부재 |
| WHO | 개발팀, QA, 감리관 |
| RISK | 코드 품질 저하 미인지, 기술 부채 누적 |
| SUCCESS | 품질 게이트 통과율 100%, 코드 스멜/버그/취약점 0건 |
| SCOPE | SonarQube CE 배포, CI 연동, 품질 정책, 대시보드 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N105.1 | SonarQube CE Helm 차트 k3s 배포 | HIGH |
| FR-N105.2 | Gitea Actions sonar-scanner 워크플로우 | HIGH |
| FR-N105.3 | 품질 게이트 정책 (버그 0, 취약점 0, 코드 스멜 A등급, 중복률 3% 이하, 커버리지 80%+) | HIGH |
| FR-N105.4 | 프로젝트별 sonar-project.properties 설정 | MED |
| FR-N105.5 | 품질 게이트 실패 시 PR 차단 스크립트 | HIGH |
| FR-N105.6 | E2E 검증 테스트 | HIGH |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | SonarQube Helm 값 파일 | infra/sonarqube/values.yaml |
| 2 | Gitea Actions 워크플로우 | .gitea/workflows/sonarqube-scan.yaml |
| 3 | sonar-project.properties | sonar-project.properties |
| 4 | 품질 게이트 정책 문서 | infra/sonarqube/quality-gate-policy.md |
| 5 | PR 차단 스크립트 | scripts/sonar-quality-gate-check.sh |
| 6 | E2E 테스트 | tests/e2e/sonarqube-integration.test.sh |

## 추적성 매트릭스

| FR ID | Design | 산출물 | 테스트 | CSAP |
|-------|--------|--------|--------|------|
| FR-N105.1 | DS-N105.1 | infra/sonarqube/ | E2E-N105.1 | D-12 |
| FR-N105.2 | DS-N105.2 | .gitea/workflows/ | E2E-N105.2 | D-12 |
| FR-N105.3 | DS-N105.3 | quality-gate-policy | E2E-N105.3 | D-12 |
| FR-N105.4 | DS-N105.4 | sonar-project.properties | E2E-N105.4 | D-12 |
| FR-N105.5 | DS-N105.5 | scripts/ | E2E-N105.5 | D-12 |
| FR-N105.6 | DS-N105.6 | tests/e2e/ | E2E-N105.6 | D-12 |
