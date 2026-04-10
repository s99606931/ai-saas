# MTU-N91: 알림 노이즈 감소 — Design

> **Phase**: 모니터링 Round 7 — 심화 최적화
> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead

---

## Design Anchor

| 항목 | 내용 |
|------|------|
| Plan 참조 | `docs/01-plan/mtus/MTU-N91-alert-noise-reduction.plan.md` |
| 기존 참조 | `infra/monitoring/alertmanager-config.yaml` (MTU-N57) |

---

## 1. 현재 문제 분석

| 문제 | 원인 | 해결 방향 |
|------|------|----------|
| 알림 폭주 | 단일 장애에 10+ 알림 동시 발생 | 의존성 기반 억제 확장 |
| 반복 알림 | 동일 알림 4시간마다 재발송 | 시간대별 repeat_interval 차등 |
| 야간 알림 | warning이 비업무 시간에도 발송 | 시간대 음소거 설정 |

---

## 2. 상세 설계

### 2.1 서비스 의존성 기반 알림 억제 확장 (FR-N91.1)

```yaml
inhibit_rules:
  # API 게이트웨이 다운 시 → 하위 서비스 알림 억제
  - source_matchers:
      - alertname="ServiceDown"
      - service="api-gateway"
    target_matchers:
      - alertname=~"ServiceDown|HighLatency|HighErrorRate"
    equal: []   # api-gateway 장애 시 모든 하위 서비스 알림 억제

  # DB 연결 장애 시 → DB 의존 서비스 알림 억제
  - source_matchers:
      - alertname=~"PostgreSQL.*Down|DatabaseConnectionFailed"
    target_matchers:
      - alertname=~"HighErrorRate|ServiceDown"

  # 인증 서비스 장애 시 → 인증 의존 서비스 알림 억제
  - source_matchers:
      - alertname="ServiceDown"
      - service="auth-service"
    target_matchers:
      - alertname="AuthenticationFailure"
```

### 2.2 자동 에스컬레이션 타이머 (FR-N91.2)

| 심각도 | 초기 대기 | 반복 주기 | 에스컬레이션 |
|--------|---------|---------|------------|
| info | 5분 | 24시간 | 없음 |
| warning | 30초 | 4시간 | 12시간 후 → SRE |
| critical | 10초 | 1시간 | 30분 후 → 관리자 |

### 2.3 시간대별 알림 정책 (FR-N91.3)

```yaml
# 업무 시간 (09:00~18:00 KST): 모든 알림 발송
# 비업무 시간: critical만 발송, warning/info 음소거
time_intervals:
  - name: business-hours
    time_intervals:
      - weekdays: ["monday:friday"]
        times:
          - start_time: "00:00"
            end_time: "09:00"   # UTC 기준 = KST 09:00~18:00

  - name: outside-business-hours
    time_intervals:
      - weekdays: ["monday:friday"]
        times:
          - start_time: "09:00"
            end_time: "24:00"
      - weekdays: ["saturday", "sunday"]
```

### 2.4 중복 제거 정책 (FR-N91.4)

group_by 키를 세분화하여 동일 사건 알림을 하나로 묶음:

```yaml
route:
  group_by: ["alertname", "namespace", "severity", "service"]
  # 동일 (alertname + namespace + service) 조합은 단일 알림으로 그룹핑
```

### 2.5 한국어 알림 템플릿 (FR-N91.5)

```
{{ define "ko.title" }}
[{{ .Status | toUpper }}] {{ .CommonLabels.alertname }} ({{ .CommonLabels.severity }})
{{ end }}

{{ define "ko.body" }}
서비스: {{ .CommonLabels.service | default "N/A" }}
네임스페이스: {{ .CommonLabels.namespace }}
시작 시간: {{ .StartsAt.Format "2006-01-02 15:04:05 KST" }}
{{ if eq .Status "resolved" }}종료 시간: {{ .EndsAt.Format "2006-01-02 15:04:05 KST" }}{{ end }}
설명: {{ .CommonAnnotations.description }}
조치: {{ .CommonAnnotations.runbook_url | default "해당 Runbook 없음" }}
{{ end }}
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
