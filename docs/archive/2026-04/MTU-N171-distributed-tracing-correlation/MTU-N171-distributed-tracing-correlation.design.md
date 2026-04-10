# MTU-N171: 분산 트레이싱 상관관계 분석 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead  
> **Plan 참조**: MTU-N171-distributed-tracing-correlation.plan.md

---

## 1. 아키텍처 옵션 분석

| 옵션 | 설명 | 장점 | 단점 |
|------|------|------|------|
| A. Tempo만 사용 | Tempo 기본 쿼리 + 서비스 그래프 | 추가 없음 | 상관 분석 제한 |
| B. Jaeger 병행 | Tempo + Jaeger UI 병행 | 풍부한 UI | 리소스 중복 |
| **C. Pragmatic Balance** | Tempo + Grafana 고급 패널 + Recording Rules | 통합 관측 | 없음 |

**선택: 옵션 C** — 기존 Tempo 메트릭 생성기를 활용하여 Grafana에서 통합 분석.

## 2. 컴포넌트 구조

```
infra/monitoring/tempo/
├── values.yaml                          (기존 — 변경 없음)
├── correlation/
│   ├── tracing-correlation-dashboard.json  (FR-N171.1)
│   ├── traceql-templates.yaml              (FR-N171.2)
│   ├── trace-log-correlation.yaml          (FR-N171.3)
│   ├── red-metrics-rules.yaml              (FR-N171.4)
│   ├── latency-alerts.yaml                 (FR-N171.5)
│   └── dependency-heatmap-dashboard.json   (FR-N171.6)
```

## 3. 크로스 서비스 트레이스 대시보드 (FR-N171.1)

### 패널 구성

| 행 | 패널 | 쿼리 원본 | 유형 |
|----|------|----------|------|
| 1 | 서비스 그래프 (토폴로지) | Tempo service_graph | Node graph |
| 1 | 요청 비율 (서비스별) | traces_service_graph_request_total | Bar chart |
| 2 | P50/P95/P99 지연 | traces_spanmetrics_latency | Time series |
| 2 | 에러율 | traces_spanmetrics_calls{status_code="STATUS_CODE_ERROR"} | Stat |
| 3 | 최근 에러 트레이스 | TraceQL: {status=error} | Table + Trace |
| 3 | 서비스 간 지연 히트맵 | traces_service_graph_request_server_seconds | Heatmap |

## 4. TraceQL 검색 템플릿 (FR-N171.2)

5개 표준 쿼리 템플릿:
1. 에러 트레이스 검색: `{status=error}`
2. 슬로우 트레이스: `{duration > 1s}`
3. 특정 서비스 경유: `{resource.service.name="auth-service"}`
4. 특정 HTTP 상태: `{span.http.status_code >= 500}`
5. 크로스 서비스 호출: `{resource.service.name="api-gateway"} >> {resource.service.name="auth-service"}`

## 5. 트레이스-로그 상관관계 (FR-N171.3)

Grafana Tempo → Loki 연동 (traceID 기반 자동 링크).

## 6. RED 메트릭 (FR-N171.4)

Tempo metrics_generator에서 자동 생성된 RED 메트릭의 Recording Rule 확장.

## 7. 지연 병목 알림 (FR-N171.5)

P99 지연이 임계값 초과 시 자동 알림.

## 8. 의존성 지연 히트맵 (FR-N171.6)

서비스 간 호출 지연을 히트맵으로 시각화.

## 9. CSAP/N2SF 매핑

| CSAP | 항목 | 구현 |
|------|------|------|
| D-06 | 감사 | 트레이스 기반 요청 이력 추적 |
| D-08 | 접근통제 | 서비스 간 호출 패턴 분석 |

## Design Anchor

- 기존 Tempo values.yaml 변경 없음
- 신규 파일은 correlation/ 하위에만 생성

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
