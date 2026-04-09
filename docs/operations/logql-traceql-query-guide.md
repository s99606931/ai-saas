# LogQL + TraceQL 고급 쿼리 가이드

> **Design Ref**: MTU-N69 Design §1, §2, §3
> **Plan SC**: FR-N69.1, FR-N69.2, FR-N69.4
> **CSAP**: D-06(감사 로그 분석), D-08(접근통제 추적)

---

## 1. LogQL 쿼리 패턴 (Loki)

### 1.1 에러 로그 분석

```logql
# L1: 프로덕션 에러 로그 검색
{namespace="production"} |= "error" | logfmt | level="error"

# L2: 특정 서비스 HTTP 500 에러
{app="auth-service"} | json | status >= 500

# L3: 느린 요청 추적 (1초 이상)
{namespace="production"} | json | duration > 1000
```

### 1.2 보안 이벤트 분석 (CSAP D-08)

```logql
# L4: 인증 실패 추적 (401 Unauthorized)
{app="auth-service"} |= "401" |= "Unauthorized"

# L5: PII 포함 로그 탐지 (주민번호 패턴)
{namespace="production"} |~ "\\d{6}-\\d{7}" | line_format "PII_DETECTED"

# L6: 감사 이벤트 조회 (CSAP D-06)
{namespace="production"} |= "audit" | json | action != ""
```

### 1.3 클러스터 장애 분석

```logql
# L7: OOM Kill 탐지
{namespace=~".+"} |= "OOMKilled"

# L8: CrashLoop 감지
{namespace=~".+"} |= "CrashLoopBackOff"
```

### 1.4 메트릭 쿼리 (통계)

```logql
# L9: 네임스페이스별 로그량 (초당 라인 수)
sum by (namespace) (rate({namespace=~".+"}[5m]))

# L10: 에러율 트렌드 (에러 로그 비율)
sum(rate({namespace="production"} |= "error" [1h]))
/
sum(rate({namespace="production"}[1h]))
```

---

## 2. TraceQL 쿼리 패턴 (Tempo)

### 2.1 에러 추적

```traceql
# T1: 에러 상태 트레이스
{status = error}

# T2: 특정 서비스 5xx 에러 트레이스
{span.http.status_code >= 500 && resource.service.name = "api-gateway"}
```

### 2.2 성능 분석

```traceql
# T3: P99 이상 느린 트레이스 (3초 초과)
{duration > 3s}

# T4: 서비스 간 호출 체인 추적
{resource.service.name = "auth-service"} >> {resource.service.name = "user-service"}
```

### 2.3 상세 검색

```traceql
# T5: 특정 HTTP 메서드 + 경로
{span.http.method = "POST" && span.http.route = "/api/auth/login"}

# T6: 에러 체인 추적 (에러가 전파된 경로)
{status = error} >> {status = error}

# T7: 특정 사용자 트레이스
{span.user.id = "user-123"}

# T8: 데이터베이스 느린 쿼리 (1초 초과)
{span.db.system = "postgresql" && duration > 1s}
```

---

## 3. 로그-트레이스 상관관계 (Loki + Tempo)

### 3.1 traceID 기반 연동

Grafana에서 Loki 로그의 traceID 필드를 클릭하면 Tempo로 자동 이동합니다.

**설정 (Loki datasource에 이미 구성됨)**:
```yaml
derivedFields:
  - datasourceUid: tempo
    matcherRegex: '"traceId":"([^"]+)"'
    name: TraceID
    url: '${__value.raw}'
```

**사용 방법**:
1. Grafana Explore에서 Loki 데이터소스 선택
2. 로그에서 `traceId` 필드 확인
3. TraceID 링크 클릭 → Tempo에서 전체 트레이스 확인

### 3.2 장애 대응 워크플로우

```
1. 알림 수신 → Grafana 대시보드 확인
2. LogQL로 에러 로그 필터링:
   {app="affected-service"} | json | level="error"
3. traceID 추출 후 Tempo에서 전체 호출 체인 확인:
   {trace:id = "abc123"}
4. 근본 원인 서비스 식별 + 해결
```

---

## 4. 유용한 LogQL 파이프라인 조합

```logql
# JSON 파싱 + 필터 + 포맷
{app="api-gateway"}
  | json
  | status >= 400
  | line_format "{{.method}} {{.path}} {{.status}} {{.duration}}ms"

# 메트릭 변환 (P99 응답시간)
quantile_over_time(0.99,
  {app="api-gateway"} | json | unwrap duration [5m]
) by (path)

# Top N 에러 경로
topk(10,
  sum by (path) (
    rate({app="api-gateway"} | json | status >= 500 [1h])
  )
)
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 (LogQL 10종 + TraceQL 8종) | PM Lead |
