# MTU-N227: Sealed Secrets + External Secrets 운영 모니터링

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초안 작성 | PM Lead |

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 시크릿 관리 파이프라인 안정성 보장, 시크릿 동기화 실패 방지 |
| 기술 | SealedSecrets 복호화 + ExternalSecrets 동기화 메트릭 |
| 품질 | 동기화 성공률 100%, 복호화 실패 즉시 알림 |
| 규제 | CSAP D-09 암호화, D-08 접근통제 |

## 기능 요구사항

| ID | 요구사항 | 검증 기준 |
|----|---------|----------|
| FR-N227.1 | Recording Rules | 동기화 상태, 복호화 성공/실패, 키 회전 |
| FR-N227.2 | 대시보드 | 시크릿 상태/동기화/복호화/키 관리 패널 |
| FR-N227.3 | 알림 규칙 | 동기화 실패, 복호화 실패, 키 만료 임박 |

## 산출물

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Recording Rules | `infra/monitoring/secrets-mgmt-rules.yaml` |
| 2 | 대시보드 | `infra/monitoring/dashboards/secrets-mgmt-dashboard.json` |
| 3 | 알림 규칙 | `infra/monitoring/secrets-mgmt-alerts.yaml` |
