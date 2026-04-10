# MTU-N226: Cert-Manager 인증서 수명주기 상세 모니터링

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초안 작성 | PM Lead |

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | TLS 인증서 만료로 인한 서비스 중단 사전 방지 |
| 기술 | cert-manager 메트릭 + 발급/갱신/만료 추적 + ACME 상태 |
| 품질 | 만료 30일 전 경고, 갱신 실패 즉시 알림, 발급 지연 < 60초 |
| 규제 | CSAP D-09 암호화, N2SF 보안 인증서 관리 |

## 기능 요구사항

| ID | 요구사항 | 검증 기준 |
|----|---------|----------|
| FR-N226.1 | cert-manager Recording Rules | 인증서 상태/만료/갱신/ACME 메트릭 |
| FR-N226.2 | 수명주기 대시보드 | 인증서 목록/만료 타임라인/갱신 이력/ACME |
| FR-N226.3 | 알림 규칙 | 만료 임박, 갱신 실패, ACME 오류, 발급 지연 |

## 산출물

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Recording Rules | `infra/monitoring/certmanager-lifecycle-rules.yaml` |
| 2 | 대시보드 | `infra/monitoring/dashboards/certmanager-lifecycle-dashboard.json` |
| 3 | 알림 규칙 | `infra/monitoring/certmanager-lifecycle-alerts.yaml` |
