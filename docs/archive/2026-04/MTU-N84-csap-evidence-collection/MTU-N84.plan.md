# MTU-N84: CSAP 증거 자동 수집 파이프라인 — Plan

> **MTU ID**: MTU-N84
> **Phase**: 6라운드 CI/CD·DevOps 고도화
> **작성일**: 2026-04-10

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | CSAP 인증 심사 준비 시간 90% 단축, 증거 수집 자동화 |
| 기술 | CronJob 기반 79개 통제항목 증거 자동 수집 + 아카이브 |
| 보안 | CSAP D-06 감사 추적, 증거 무결성 해시 검증 |
| 운영 | 일일 자동 수집 + 주간 보고서 + 심사 대비 패키지 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N84.1 | CSAP 79개 통제항목 증거 수집 CronJob | HIGH |
| FR-N84.2 | 증거 유형별 수집기 (로그/설정/스크린샷/정책) | HIGH |
| FR-N84.3 | 증거 무결성 해시(SHA-256) 자동 생성 | HIGH |
| FR-N84.4 | 증거 아카이브 (일별 디렉토리) | MED |
| FR-N84.5 | 증거 완전성 보고서 (미수집 항목 알림) | HIGH |
| FR-N84.6 | 심사 대비 패키지 자동 생성 | MED |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | 증거 수집 CronJob | infra/compliance/evidence-collector/cronjob.yaml |
| 2 | 증거 매핑 설정 | infra/compliance/evidence-collector/evidence-map.yaml |
| 3 | 수집 스크립트 | scripts/csap-evidence-collect.sh |
| 4 | 완전성 검사 스크립트 | scripts/csap-evidence-verify.sh |
| 5 | E2E 테스트 | tests/e2e/test-csap-evidence.sh |
