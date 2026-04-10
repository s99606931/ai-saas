# MTU-N85: 감사 보고서 자동 생성 — Plan

> **MTU ID**: MTU-N85
> **Phase**: 6라운드 CI/CD·DevOps 고도화
> **작성일**: 2026-04-10

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | CSAP 감사 보고서 자동 생성으로 심사 준비 시간 대폭 단축 |
| 기술 | 증거 수집 데이터 + 규정 준수 드리프트 탐지 → 보고서 생성 |
| 보안 | CSAP D-06 감사 추적 완전성, 행안부 감리 체크리스트 자동화 |
| 운영 | 주간/월간 자동 보고서, 규정 준수율 대시보드 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N85.1 | CSAP 규정 준수 현황 보고서 자동 생성 | HIGH |
| FR-N85.2 | 규정 준수 드리프트 자동 탐지 | HIGH |
| FR-N85.3 | 행안부 감리 체크리스트 자동 점검 | HIGH |
| FR-N85.4 | JSON + HTML 보고서 형식 | MED |
| FR-N85.5 | 주간/월간 자동 생성 스케줄 | MED |
| FR-N85.6 | 규정 준수율 Prometheus 메트릭 | MED |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | 보고서 생성 CronJob | infra/compliance/report-generator/cronjob.yaml |
| 2 | 드리프트 탐지 설정 | infra/compliance/report-generator/drift-detection.yaml |
| 3 | 감리 체크리스트 스크립트 | scripts/audit-checklist-verify.sh |
| 4 | 알림 규칙 | infra/compliance/report-generator/alerting-rules.yaml |
| 5 | E2E 테스트 | tests/e2e/test-audit-report.sh |
