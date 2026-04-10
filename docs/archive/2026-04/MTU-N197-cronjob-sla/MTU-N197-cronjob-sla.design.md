# MTU-N197: CronJob 실행 성공률 및 SLA 모니터링 -- Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/MTU-N197-cronjob-sla.plan.md

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | Pragmatic Balance -- kube-state-metrics CronJob/Job 메트릭 |
| 메트릭 소스 | kube_cronjob_*, kube_job_* |
| SLA 계산 | 성공 Job 수 / 전체 Job 수 (24h/7d 윈도우) |

## 상세 설계

### 1. Recording Rules (FR-N197.1, FR-N197.4)

```yaml
cronjob_sla:success_rate_24h -- 24시간 성공률
cronjob_sla:success_rate_7d -- 7일 성공률
cronjob_sla:last_successful_time -- 마지막 성공 시각
cronjob_sla:overdue_seconds -- 예정 시간 대비 지연(초)
cronjob_sla:avg_duration -- 평균 실행 시간
```

### 2. Alerting Rules (FR-N197.2, FR-N197.3, FR-N197.4)

| 알림명 | 조건 | 심각도 | for |
|--------|------|--------|-----|
| CronJobConsecutiveFailures | 연속 3회 실패 | critical | 0m |
| CronJobOverdue | 예정 시간 2배 초과 미실행 | warning | 10m |
| CronJobSLABreach | 24h 성공률 < 95% | critical | 15m |
| CronJobDurationAnomaly | 평균 대비 3배 소요 | warning | 5m |

### 3. CSAP 매핑

| CSAP | 항목 | 구현 |
|------|------|------|
| D-06 | 침해사고 관리 | 감사 로그 수집 CronJob 신뢰성 보장 |
| D-10 | 서비스 가용성 | 정기 작업 SLA 준수 |
| D-12 | 개발 보안 | E2E 테스트 검증 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
