# MTU-N95: 감리 Q-Gate 100% 자동 검증 파이프라인 — Plan

> **MTU ID**: MTU-N95
> **Phase**: 7라운드 CI/CD·DevOps 고도화
> **작성일**: 2026-04-10
> **우선순위**: CRITICAL (감리 100% 달성 최종 MTU)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 감리 준수율 91% -> 100% 최종 달성, 자동 검증 파이프라인 |
| 기술 | Q-Gate G1~G7 전수 자동 검증 + 감리 대비 보고서 자동 생성 |
| 보안 | CSAP 79항목 + N2SF 6영역 + ISMS-P 자동 준수 확인 |
| 운영 | 감리 심사 전 자동 사전 검증, 불통과 항목 즉시 알림 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N95.1 | Q-Gate G1~G7 전수 자동 검증 스크립트 | HIGH |
| FR-N95.2 | CSAP 79항목 자동 커버리지 검증 | HIGH |
| FR-N95.3 | 감리 대비 보고서 자동 생성 | HIGH |
| FR-N95.4 | 미달 항목 자동 탐지 + 개선 가이드 | HIGH |
| FR-N95.5 | 감리 검증 Gitea Actions 워크플로우 | MED |
| FR-N95.6 | E2E 테스트 | HIGH |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Q-Gate 검증 스크립트 | scripts/qgate-verify.sh |
| 2 | CSAP 커버리지 검증 | scripts/csap-coverage-check.sh |
| 3 | 감리 대비 보고서 생성 | scripts/audit-readiness-report.sh |
| 4 | 감리 검증 워크플로우 | .gitea/workflows/audit-gate.yaml |
| 5 | E2E 테스트 | tests/e2e/test-qgate-pipeline.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 작성 | PM Agent |
