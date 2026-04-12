# MTU-N121: SLO 에러 예산 자동 리포팅

> 버전: 1.0.0 | 작성일: 2026-04-10

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | SLO 달성률 + 에러 예산 잔여율을 주간/월간 자동 리포트로 관리자에게 제공 |
| 기술 | Prometheus API 기반 SLI/SLO 메트릭 자동 수집 + Markdown 보고서 생성 |
| 보안 | CSAP D-06 침해사고 관리, SLO 위반 이력 감사 추적 |
| 운영 | 에러 예산 소진 추이 시각화, MTTR/MTTD 자동 계산, SLA 준수 보고 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | SLO 알림은 있으나 주기적 리포팅 체계 부재. 경영진/감리관에게 SLA 준수 현황 보고 필요 |
| WHO | SRE팀 (운영), 경영진 (보고), 감리관 (검증) |
| RISK | SLO 위반 누적 시 SLA 위반 → 계약 위약 가능. 리포트 없으면 추적 불가 |
| SUCCESS | 주간/월간 SLO 보고서 자동 생성, 에러 예산 소진 추이 가시화 |
| SCOPE | 보고서 생성 스크립트 + Grafana 보고용 대시보드 + PrometheusRule |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N121.1 | SLO 에러 예산 주간 보고서 자동 생성 스크립트 | HIGH |
| FR-N121.2 | 서비스별 SLI/SLO 달성률 Markdown 테이블 생성 | HIGH |
| FR-N121.3 | 에러 예산 소진 추이 Recording Rule | MED |
| FR-N121.4 | MTTR/MTTD 자동 계산 및 리포트 포함 | MED |
| FR-N121.5 | 에러 예산 소진 예측 (선형 회귀) | LOW |
| FR-N121.6 | E2E 테스트 | HIGH |
