# 개발 디버깅 및 로그 조회 가이드

> **버전**: 1.0.0 | **작성일**: 2026-04-08 | **작성자**: Implementer Agent
> **MTU**: MTU-N24 | **CSAP**: D-06 (감사로그 보존), D-12 (로그 내 PII 마스킹)
> **배포 방식**: k3s + Helm Chart (Docker Compose 사용 안 함)

---

## 1. 개요

이 가이드는 Grafana의 **Loki (LogQL)** 와 **Tempo (TraceQL)** 를 조합하여 마이크로서비스 문제를 빠르게 디버깅하는 방법을 설명합니다.

### 두 도구의 역할 비교

| 도구 | 질문 유형 | 예시 |
|------|----------|------|
| Loki (로그) | "무슨 일이 일어났나?" | 에러 메시지, 스택 트레이스 |
| Tempo (트레이스) | "왜 느린가? 어디서 막혔나?" | 서비스 간 호출 흐름, 스팬 시간 |

**두 도구를 함께 쓰는 이유**: Loki 로그에서 `traceId` 필드를 클릭하면 Tempo의 해당 트레이스로 바로 이동할 수 있습니다. 하나의 HTTP 요청이 여러 마이크로서비스를 거치는 전체 흐름을 한눈에 파악합니다.

```
사용자 요청 발생
    ↓
Grafana Explore에서 로그 조회 (Loki LogQL)
    ↓
에러 로그에서 traceId 클릭
    ↓
Tempo에서 전체 서비스 호출 그래프 확인
    ↓
느린 스팬(span) 특정 → 코드 수정
```

---

## 2. Grafana Explore에서 로그 조회

### 2.1 Explore 진입 방법

```
Grafana 접속 → 좌측 메뉴 나침반 아이콘 (Explore) 클릭
데이터소스 선택: "Loki" 선택
```

직접 URL로 접근:

```
http://localhost:30300/explore?orgId=1&left={"datasource":"loki"}
```

### 2.2 LogQL 기본 문법

LogQL은 스트림 선택자와 필터 표현식으로 구성됩니다.

**스트림 선택자 (필수):**

```logql
# 특정 네임스페이스의 모든 로그
{namespace="app"}

# 특정 서비스 로그
{app="api-server", namespace="app"}

# 여러 조건 (AND)
{namespace="app", container="api-server"}
```

**라인 필터 (스트림 선택 후 파이프로 연결):**

```logql
# 특정 문자열 포함
{namespace="app"} |= "ERROR"

# 특정 문자열 제외
{namespace="app"} != "healthcheck"

# 정규식 매치
{namespace="app"} |~ "ERROR|WARN"

# 정규식 제외
{namespace="app"} !~ "GET /health|GET /metrics"
```

**JSON 파싱 및 필드 필터:**

```logql
# JSON 로그에서 필드 추출 후 필터
{namespace="app"} | json | level="error"

# statusCode 필드로 필터
{namespace="app"} | json | statusCode >= 500

# 특정 사용자 ID 관련 로그 (PII 주의: 실제 이름 아닌 ID 사용)
{namespace="app"} | json | userId="user-uuid-here"
```

**rate 함수 (집계):**

```logql
# 초당 에러 로그 발생률
rate({namespace="app"} |= "ERROR" [5m])

# 서비스별 초당 요청 수
sum by (app) (rate({namespace="app"} [1m]))
```

### 2.3 서비스별 에러 로그 조회 예제

```logql
# api-server 에러 로그 전체 조회
{app="api-server", namespace="app"} | json | level="error"

# HTTP 5xx 응답 조회
{app="api-server", namespace="app"} | json | statusCode >= 500

# 데이터베이스 연결 오류
{namespace="app"} |~ "connection refused|ECONNREFUSED|DB_CONN_ERR"

# 특정 API 엔드포인트 오류
{app="api-server", namespace="app"} |= "POST /api/v1/users" |= "ERROR"

# 마지막 1시간 동안 에러 발생 서비스 목록
sum by (app) (
  count_over_time({namespace="app"} | json | level="error" [1h])
)

# 스택 트레이스가 있는 로그만 조회 (Java/Node.js 예외)
{namespace="app"} |~ "at .+\(.+\.js:[0-9]+\)|at .+\(.+\.java:[0-9]+\)"
```

### 2.4 타임라인 범위 지정 및 실시간 추적

**시간 범위 지정:**

```
Grafana Explore 우측 상단 시간 선택기
→ "Last 15 minutes" (빠른 디버깅)
→ "Last 1 hour" (배포 이후 전체 확인)
→ 사용자 정의: "2026-04-08 14:00 ~ 14:30" (특정 장애 시간대)
```

**실시간 로그 스트림 (Live Tail):**

```
Explore 화면 → 우측 상단 "Live" 버튼 클릭
→ 새 로그가 실시간으로 화면에 추가됨 (배포 중 감시에 유용)
```

---

## 3. 분산 추적(Distributed Tracing)으로 요청 추적

### 3.1 Grafana Explore에서 Tempo 접근

```
Grafana Explore → 데이터소스 선택: "Tempo"
```

### 3.2 TraceQL 기본 문법

```traceql
# 특정 서비스의 모든 트레이스
{resource.service.name="api-server"}

# 에러가 있는 트레이스
{status=error}

# 특정 HTTP 경로
{span.http.url =~ ".*\\/api\\/v1\\/users.*"}

# 여러 조건 결합
{resource.service.name="api-server" && status=error}

# HTTP 메서드와 상태코드 조합
{span.http.method="POST" && span.http.status_code >= 500}
```

### 3.3 특정 API 요청의 서비스 간 흐름 추적

```traceql
# POST /api/v1/payments 요청 중 에러 발생 트레이스 조회
{span.http.url =~ ".*/api/v1/payments" && span.http.method="POST" && status=error}

# 특정 사용자 세션의 트레이스 (traceId로 조회)
# Loki 로그에서 복사한 traceId 직접 입력
```

Tempo에서 트레이스 ID로 직접 조회:

```
Grafana Explore (Tempo) → 검색 탭 → TraceID 입력란에 붙여넣기
```

### 3.4 느린 스팬(span) 탐지 (500ms 초과)

```traceql
# 전체 트레이스 지속시간 500ms 초과
{resource.service.name="api-server"} | duration > 500ms

# 특정 서비스의 데이터베이스 스팬이 느린 경우
{span.db.system="postgresql"} | duration > 200ms

# 1초 초과 트레이스 (심각한 지연)
{} | duration > 1s

# 서비스별 p99 레이턴시 비교 (Grafana 대시보드 패널 쿼리)
{resource.service.name=~".+"} | duration > 0ms
```

트레이스 결과 화면에서 확인할 내용:

```
플레임 그래프(Flame Graph) 탭:
- 가로 너비가 넓은 스팬 = 실행 시간이 긴 작업
- 색상이 다른 스팬 = 다른 서비스 호출

워터폴(Waterfall) 탭:
- 스팬 순서 및 병렬/순차 실행 구조 확인
- 각 스팬의 정확한 시작/종료 시각
- span.db.statement: 실행된 SQL 쿼리 (pg_stat_statements와 연계)
```

---

## 4. 로그-트레이스 상관관계(Correlation) 사용법

### 4.1 Loki 로그에서 Tempo 트레이스로 이동

이 기능은 Grafana Datasource 설정에서 자동으로 구성됩니다 (`infra/monitoring/` 설정 참조).

**사용 방법:**

```
1. Grafana Explore → 데이터소스: Loki
2. 에러 로그 조회: {namespace="app"} | json | level="error"
3. 로그 라인 클릭 → 로그 상세 펼치기
4. "traceId" 필드 옆 Tempo 아이콘 클릭
5. Tempo 트레이스 화면으로 자동 이동
```

### 4.2 traceId 필드 기반 연동

마이크로서비스의 로그가 traceId를 포함하면 연동이 자동으로 활성화됩니다.

**Node.js 서비스 로그 출력 예시 (올바른 형식):**

```javascript
// Design Ref: §5 — Loki-Tempo 상관관계를 위한 traceId 포함 로그
const { trace } = require('@opentelemetry/api')

function getTraceContext() {
  const span = trace.getActiveSpan()
  if (!span) return {}
  const { traceId, spanId } = span.spanContext()
  return { traceId, spanId }
}

// 에러 로그 출력 시 traceId 포함
logger.error('결제 처리 실패', {
  ...getTraceContext(),
  userId: req.user.id,         // ID만 (이름/이메일 제외 — CSAP D-12)
  errorCode: 'PAYMENT_FAILED',
  // 주의: 카드번호, 주민번호 등 PII 절대 포함 금지
})
```

**Python 서비스 로그 출력 예시:**

```python
from opentelemetry import trace
import json, logging

def get_trace_context():
    span = trace.get_current_span()
    ctx = span.get_span_context()
    return {
        "traceId": format(ctx.trace_id, '032x'),
        "spanId": format(ctx.span_id, '016x'),
    }

logger.error(json.dumps({
    **get_trace_context(),
    "level": "error",
    "message": "DB 연결 실패",
    "service": "data-processor",
}))
```

**Grafana Datasource 연동 확인:**

```bash
# Datasource ConfigMap 확인
kubectl get configmap grafana-datasources-extra -n monitoring -o yaml | grep -A10 "derivedFields"
```

예상 출력:

```yaml
derivedFields:
  - datasourceUid: tempo
    matcherRegex: '"traceId":"([^"]+)"'
    name: TraceID
    url: '${__value.raw}'
```

---

## 5. 개발팀 일상 워크플로우

### 5.1 버그 발생 시 5단계 디버깅 절차

```
[1단계] 버그 발생 시각 특정
    → Grafana Explore (Loki) 열기
    → 시간 범위: 버그 발생 전후 15분으로 설정
    → 쿼리: {namespace="app"} | json | level="error"

[2단계] 에러 로그에서 패턴 파악
    → 어떤 서비스(app 레이블)에서 에러 발생?
    → 에러 메시지, errorCode 확인
    → traceId 필드가 있으면 복사

[3단계] Tempo에서 트레이스 추적
    → Explore 데이터소스를 Tempo로 전환
    → traceId 붙여넣기 또는 로그 라인에서 Tempo 아이콘 클릭
    → 워터폴 뷰에서 어느 스팬이 가장 오래 걸렸는지 확인

[4단계] 느린 구간 상세 분석
    → 스팬 클릭 → span.db.statement 확인 (슬로우쿼리 여부)
    → 외부 서비스 호출 타임아웃 여부 확인
    → 스팬 속성에서 http.status_code, db.rows_affected 확인

[5단계] 재현 및 수정
    → 로그 + 트레이스 정보를 GitHub 이슈에 첨부
    → 슬로우쿼리 → SQL 모니터링 가이드 참조
    → 재발 방지 → AlertManager 알림 규칙 추가
```

### 5.2 배포 후 모니터링 체크리스트

배포 직후 15분간 다음을 순서대로 확인합니다.

```bash
# [체크1] 파드 재시작 없이 정상 실행 중인지 확인
kubectl get pods -n <앱-네임스페이스> --sort-by='.status.containerStatuses[0].restartCount'

# [체크2] 에러 로그 급증 여부 확인 (Grafana Loki)
# 쿼리: rate({namespace="app"} | json | level="error" [5m])
# 기준: 배포 전 대비 2배 이상이면 롤백 검토

# [체크3] HTTP 5xx 에러율 확인 (Prometheus 메트릭)
# Grafana "서비스 트래픽" 대시보드 → 에러율 패널 확인
# 기준: 1% 초과 시 즉시 확인

# [체크4] 응답 시간 p99 확인
# Grafana → 서비스 트래픽 대시보드 → Latency p99
# 기준: 배포 전 대비 20% 이상 증가 시 확인

# [체크5] 데이터베이스 연결 수 정상 여부
kubectl port-forward svc/kube-prometheus-stack-prometheus 9090 -n monitoring &
# PromQL: pg_stat_activity_count{datname="saasdb", state="active"}
# 기준: 평소 대비 급증 여부

# [체크6] AlertManager에 새 알림이 없는지 확인
kubectl port-forward svc/kube-prometheus-stack-alertmanager 9093 -n monitoring &
curl -s http://localhost:9093/api/v2/alerts | python3 -m json.tool
```

---

## 6. kubectl 로그 조회 명령 vs Grafana 비교

두 방법은 상황에 따라 선택합니다.

| 상황 | 권장 방법 | 이유 |
|------|----------|------|
| 빠른 현황 파악 (터미널에서) | kubectl logs | 추가 설정 불필요, 즉시 확인 |
| 과거 로그 조회 (1시간 이전) | Grafana Loki | kubectl은 현재 파드만 가능 |
| 여러 파드 동시 로그 | Grafana Loki | kubectl은 파드 1개씩만 가능 |
| 에러 패턴 분석 | Grafana Loki | 집계 함수, 시각화 가능 |
| 트레이스 연동 | Grafana Loki + Tempo | kubectl은 트레이스 연동 불가 |
| 파드 재시작 직후 | kubectl logs --previous | 이전 컨테이너 로그 접근 가능 |

### kubectl 로그 조회 명령 모음

```bash
# 파드 로그 실시간 스트림
kubectl logs -f <파드명> -n <네임스페이스>

# 최근 100줄
kubectl logs <파드명> -n <네임스페이스> --tail=100

# 이전 컨테이너 로그 (OOMKilled, CrashLoopBackOff 이후)
kubectl logs <파드명> -n <네임스페이스> --previous

# Deployment의 모든 파드 로그 동시 조회 (ReplicaSet 포함)
kubectl logs -l app=api-server -n <네임스페이스> --all-containers=true --tail=50

# 특정 시간 이후 로그
kubectl logs <파드명> -n <네임스페이스> --since=1h

# 타임스탬프 포함
kubectl logs <파드명> -n <네임스페이스> --timestamps=true --tail=50

# 에러 키워드 필터링 (파이프 사용)
kubectl logs <파드명> -n <네임스페이스> --tail=200 | grep -i "error\|panic\|fatal"
```

### Grafana Loki 동일 기능 쿼리

```logql
# 실시간 스트림 → Grafana Live 버튼 사용
{app="api-server", namespace="app"}

# 에러만 필터 (kubectl grep 대체)
{app="api-server", namespace="app"} |= "ERROR"

# 모든 파드 동시 조회 (kubectl -l 대체)
{namespace="app"} | json

# 타임스탬프 기준 조회 → Grafana 시간 범위 선택기 사용
{namespace="app"} | json | level="error"

# 이전 파드 로그 (Loki는 파드 재시작 후에도 로그 보존)
# → Grafana에서 시간 범위를 파드 재시작 이전으로 설정하면 조회 가능
```

---

## 7. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 (MTU-N24 기반) | Implementer Agent |
