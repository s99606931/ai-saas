# MTU-N181: 애플리케이션 로그 패턴 이상 탐지 Design

> **문서 ID**: DESIGN-N181 | **버전**: 1.0 | **작성일**: 2026-04-10
> **작성자**: PM Lead | **상태**: 승인

---

## Executive Summary

| 관점 | 설계 결정 |
|------|----------|
| 아키텍처 | Loki Ruler 기반 로그 알림 + Prometheus recording rules 연동 |
| 데이터 흐름 | Promtail → Loki → Ruler (LogQL 알림) + Prometheus (메트릭 recording) → Grafana |
| 보안 | 인증 실패/권한 위반 패턴 자동 감지, CSAP D-06/D-08 준수 |
| 운영 | 에러율 급증, 볼륨 이상, 보안 패턴 3대 영역 자동 알림 |

## Design Anchor

```
Plan 참조: PLAN-N181
FR 범위: FR-N181.1 ~ FR-N181.6
CSAP 매핑: D-06 (침해사고 관리), D-08 (접근 통제), D-12 (시스템 개발 보안)
N2SF 매핑: N-03 (격리 영역)
```

## 아키텍처 옵션 분석

| 옵션 | 장점 | 단점 | 선택 |
|------|------|------|------|
| A: Loki Ruler + LogQL 알림 | 로그 네이티브, 기존 스택 활용 | 복잡한 ML 탐지 제한 | **선택** |
| B: ElasticSearch + ML 이상 탐지 | 고급 ML 기능 | 추가 인프라, 외부 서비스 위험 | - |
| C: 커스텀 로그 분석 파이프라인 | 최대 유연성 | 개발/운영 부담 | - |

## 상세 설계

### DS-N181.1: 에러 로그 비율 모니터링

```yaml
# Loki Ruler: 에러율 급증 알림
- alert: LogErrorRateHigh
  expr: |
    sum by (namespace, app) (
      rate({namespace=~".+"} |= "error" [5m])
    ) / sum by (namespace, app) (
      rate({namespace=~".+"} [5m])
    ) > 0.1
  for: 5m
```

### DS-N181.2: 로그 볼륨 이상 탐지

```yaml
# 로그 볼륨 급증 (3배 이상)
- alert: LogVolumeSurge
  expr: |
    sum by (namespace) (rate({namespace=~".+"} [5m]))
    > 3 * sum by (namespace) (rate({namespace=~".+"} [1h] offset 1h))
```

### DS-N181.3: 보안 로그 패턴 감지

```yaml
# 인증 실패 다발
- alert: AuthenticationFailureBurst
  expr: |
    sum by (namespace) (
      count_over_time({namespace=~".+"} |~ "(?i)(authentication failed|login failed|unauthorized|401)" [5m])
    ) > 10
```

### DS-N181.4: 대시보드 레이아웃

```
Row 1: 종합 현황
  - 에러 로그 비율 | 로그 볼륨 이상 수 | 보안 패턴 감지 수 | 스택트레이스 수
Row 2: 시계열
  - 에러율 추이 | 로그 볼륨 추이
Row 3: 상세
  - 인증 실패 추이 | 스택트레이스 이벤트 | N2SF 등급별 로그 볼륨
```

### DS-N181.5: 스택트레이스/패닉 로그 감지

```yaml
- alert: StackTraceDetected
  expr: |
    sum by (namespace, app) (
      count_over_time({namespace=~".+"} |~ "(?i)(panic|stacktrace|fatal|exception)" [5m])
    ) > 0
```

### DS-N181.6: N2SF 등급별 로그 볼륨

```yaml
# Prometheus recording rule
- record: n2sf:log:volume_by_grade
  expr: |
    sum by (namespace, n2sf_grade) (
      promtail_custom_log_entries_total
    ) * on(namespace) group_left(n2sf_grade)
    kube_namespace_labels{label_n2sf_grade=~".+"}
```

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초안 작성 | PM Lead |
