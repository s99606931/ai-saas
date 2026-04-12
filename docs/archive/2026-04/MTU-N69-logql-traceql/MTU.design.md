# MTU-N69: Loki LogQL + Tempo TraceQL 고급 쿼리 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead (Opus)

---

## 1. LogQL 쿼리 패턴 설계 (FR-N69.1)

### 1.1 운영 필수 쿼리 10종

| # | 용도 | LogQL |
|---|------|-------|
| L1 | 에러 로그 검색 | `{namespace="production"} |= "error" \| logfmt \| level="error"` |
| L2 | 특정 서비스 에러 | `{app="auth-service"} \| json \| status >= 500` |
| L3 | 느린 요청 추적 | `{namespace="production"} \| json \| duration > 1000` |
| L4 | 인증 실패 추적 | `{app="auth-service"} \|= "401" \|= "Unauthorized"` |
| L5 | PII 포함 로그 탐지 | `{namespace="production"} \|~ "\\d{6}-\\d{7}" \| line_format "PII_DETECTED"` |
| L6 | 감사 이벤트 조회 | `{namespace="production"} \|= "audit" \| json \| action != ""` |
| L7 | OOM Kill 탐지 | `{namespace=~".+"} \|= "OOMKilled"` |
| L8 | CrashLoop 로그 | `{namespace=~".+"} \|= "CrashLoopBackOff"` |
| L9 | 네임스페이스별 로그량 | `sum by (namespace) (rate({namespace=~".+"}[5m]))` |
| L10 | 에러율 트렌드 | `sum(rate({namespace="production"} \|= "error" [1h])) / sum(rate({namespace="production"}[1h]))` |

### 1.2 Loki Alerting Rules (FR-N69.3)

```yaml
groups:
  - name: saas-log-alerts
    rules:
      - alert: HighErrorLogRate
        expr: sum(rate({namespace="production"} |= "error" [5m])) > 10
      - alert: AuthenticationFailureSpike
        expr: sum(rate({app="auth-service"} |= "401" [5m])) > 5
      - alert: PIILeakageDetected
        expr: sum(rate({namespace="production"} |~ "\\d{6}-\\d{7}" [5m])) > 0
```

## 2. TraceQL 쿼리 패턴 설계 (FR-N69.2)

### 2.1 운영 필수 쿼리 8종

| # | 용도 | TraceQL |
|---|------|---------|
| T1 | 에러 트레이스 | `{status = error}` |
| T2 | 특정 서비스 느린 요청 | `{span.http.status_code >= 500 && resource.service.name = "api-gateway"}` |
| T3 | P99 이상 트레이스 | `{duration > 3s}` |
| T4 | 서비스 간 호출 | `{resource.service.name = "auth-service"} >> {resource.service.name = "user-service"}` |
| T5 | 특정 HTTP 메서드 | `{span.http.method = "POST" && span.http.route = "/api/auth/login"}` |
| T6 | 에러 체인 추적 | `{status = error} >> {status = error}` |
| T7 | 특정 사용자 트레이스 | `{span.user.id = "user-123"}` |
| T8 | 데이터베이스 느린 쿼리 | `{span.db.system = "postgresql" && duration > 1s}` |

## 3. 로그-트레이스 상관관계 (FR-N69.4)

Loki → Tempo 연동: traceID 기반
```
LogQL: {app="api-gateway"} | json | traceId != "" | line_format "{{.traceId}}"
→ Grafana Derived Field → Tempo TraceQL: {trace:id = "<traceId>"}
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
