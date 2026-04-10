# MTU-N188: ConfigMap/Secret 변경 감지 모니터링 — Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/MTU-N188-configmap-secret-change-monitoring.plan.md

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 옵션 | Pragmatic Balance — kube-state-metrics 활용 |
| 데이터 소스 | kube-state-metrics (configmap/secret metadata) |
| CSAP 중점 | D-06 감사 로깅, D-09 암호화 관리 |
| 대시보드 | Grafana JSON Provisioning |

## DS-N188.1: ConfigMap 변경 빈도

```promql
changes(kube_configmap_metadata_resource_version[5m])
```

## DS-N188.2: Secret 변경 빈도

```promql
changes(kube_secret_metadata_resource_version[5m])
```

## DS-N188.3: 비정상 시간대 변경 알림

업무 시간(09:00~18:00 KST) 외 변경을 비정상으로 간주합니다.

```promql
hour() < 0 or hour() >= 9  # UTC 기준 0시=KST 9시, 9시=KST 18시
```

## DS-N188.4: 과다 변경 알림

5분 내 동일 네임스페이스에서 3건 이상 ConfigMap/Secret 변경.

## DS-N188.5: 대시보드 패널

| 행 | 패널 | 타입 |
|----|------|------|
| 0 | 변경 상태 개요 (ConfigMap/Secret 변경 수) | stat |
| 1 | ConfigMap 변경 타임라인 | timeseries |
| 2 | Secret 변경 타임라인 | timeseries |
| 3 | 네임스페이스별 변경 빈도 | bargauge |
| 4 | ConfigMap/Secret 총 개수 추세 | timeseries |
| 5 | 최근 변경 목록 (Table) | table |
| 6 | 비정상 시간대 변경 히스토리 | timeseries |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
