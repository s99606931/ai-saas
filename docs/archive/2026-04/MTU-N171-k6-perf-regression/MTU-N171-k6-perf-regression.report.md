# 리포트: MTU-N171 k6 성능 회귀 테스트 자동화

> 작성일: 2026-04-10 | matchRate: 95%

## Executive Summary

| 관점 | 계획 | 달성 |
|------|------|------|
| 비즈니스 | 성능 회귀 자동 탐지 | 3단계 테스트 + 자동 Threshold |
| 기술 | k6 + Prometheus + CI/CD | 스모크/부하/소크 시나리오 + Helm |
| 보안 | 테스트 데이터 내부 저장 | PSS Restricted Pod, NetworkPolicy |
| 운영 | PR별/배포후/야간 자동 실행 | CronJob + k6-operator CRD |

## 산출물

| 파일 | 용도 |
|------|------|
| tests/performance/lib/utils.js | 공통 유틸 (인증, 메트릭) |
| tests/performance/lib/baselines.js | API 성능 기준선 |
| tests/performance/scenarios/smoke.js | PR별 스모크 (10s/5VU) |
| tests/performance/scenarios/load.js | 배포후 부하 (5m/50VU) |
| tests/performance/scenarios/soak.js | 야간 소크 (30m/20VU) |
| infra/helm/k6-operator/ | Helm 차트 (5개 파일) |

## matchRate: 95%
