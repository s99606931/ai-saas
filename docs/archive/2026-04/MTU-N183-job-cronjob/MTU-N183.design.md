# MTU-N183: 쿠버네티스 잡/크론잡 모니터링 Design

> **문서 ID**: DESIGN-N183 | **버전**: 1.0 | **작성일**: 2026-04-10
> **작성자**: PM Lead | **상태**: 승인

---

## Design Anchor

```
Plan 참조: PLAN-N183
FR 범위: FR-N183.1 ~ FR-N183.6
CSAP 매핑: D-06 (침해사고 관리), D-12 (시스템 개발 보안)
```

## 아키텍처

kube-state-metrics 기반 Job/CronJob 상태 메트릭 활용. 추가 인프라 불필요.

## 상세 설계

### DS-N183.1: Job 성공/실패 모니터링

```yaml
- record: namespace:job:failed_count
  expr: sum by (namespace, job_name) (kube_job_status_failed)
- alert: KubeJobFailed
  expr: kube_job_status_failed > 0
```

### DS-N183.2: CronJob 스케줄 누락 감지

```yaml
- alert: CronJobMissedSchedule
  expr: time() - kube_cronjob_status_last_schedule_time > kube_cronjob_spec_schedule_interval * 1.5
```

### DS-N183.3: 장시간 실행 Job

```yaml
- alert: KubeJobRunningLong
  expr: time() - kube_job_status_start_time{job_name!=""} > 3600
  # AND kube_job_status_completion_time == 0
```

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초안 작성 | PM Lead |
