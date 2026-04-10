# MTU-N121: SLO 에러 예산 자동 리포팅 -- 완료 보고서

> 작성일: 2026-04-10 | matchRate: 100% | 테스트: 28/28

## Executive Summary

| 관점 | 목표 | 달성 |
|------|------|------|
| 비즈니스 | SLO 달성률 주간/월간 자동 보고서 | 100% |
| 기술 | Prometheus API 기반 SLI/SLO 수집 + Markdown 생성 | 100% |
| 보안 | CSAP D-06 감사 추적 | 100% |
| 운영 | Recording Rule + E2E 테스트 28항목 | 100% |

## 산출물

| FR ID | 산출물 | 경로 | 상태 |
|-------|--------|------|------|
| FR-N121.1 | SLO 보고서 생성 스크립트 | `scripts/generate-slo-report.sh` | 완료 |
| FR-N121.2 | 서비스별 SLI/SLO 테이블 | 스크립트에 포함 | 완료 |
| FR-N121.3 | Recording Rule 확장 | `infra/monitoring/slo-reporting-rules.yaml` | 완료 |
| FR-N121.4 | MTTR/MTTD 자동 계산 | Recording Rule + 스크립트 | 완료 |
| FR-N121.5 | 에러 예산 소진 예측 | Recording Rule + 스크립트 | 완료 |
| FR-N121.6 | E2E 테스트 | `scripts/test-slo-report.sh` | 28/28 통과 |

## 주요 구현 내용

1. **SLO 보고서 자동 생성**: 5개 서비스(api-gateway, auth-service, tenant-service, plugin-service, document-service)의 SLI/SLO 달성률 + 에러 예산 잔여율 자동 보고서
2. **Recording Rule 확장**: 일간/주간 에러율, 가용성, MTTR, 에러 예산 소진 예측 사전 계산
3. **Burn Rate 분석**: 1시간/6시간 Burn Rate + 해석 기준 + 에러 예산 소진 예측일
4. **자동 보고 알림**: 주간(월요일 09:00), 월간(1일 09:00) 보고서 생성 PrometheusRule
