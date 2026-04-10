# MTU-N147: 통합 헬스체크 엔드포인트 표준 — Design

> **문서 ID**: MTU-N147.design
> **버전**: 1.0.0 | **작성일**: 2026-04-10
> **Plan 참조**: MTU-N147.plan

---

## SS1. 3대 헬스체크 엔드포인트

| 엔드포인트 | 용도 | K8s 매핑 | 응답 시간 |
|-----------|------|---------|----------|
| `/health` | 전체 건강 상태 (의존성 포함) | - | < 3초 |
| `/ready` | 요청 수신 가능 여부 | readinessProbe | < 1초 |
| `/live` | 프로세스 생존 여부 | livenessProbe | < 500ms |

## SS2. 표준 응답 형식

```json
{
  "status": "healthy|degraded|unhealthy",
  "timestamp": "2026-04-10T12:00:00Z",
  "service": "api-gateway",
  "version": "1.2.0",
  "dependencies": {
    "database": { "status": "healthy", "latency_ms": 5 },
    "redis": { "status": "healthy", "latency_ms": 2 },
    "auth-service": { "status": "healthy", "latency_ms": 15 }
  }
}
```

## SS3. Blackbox Exporter 프로브 설계

- 13개 서비스 x 2 프로브 (ready + live) = 26개 프로브
- 간격: 30초 (ready), 15초 (live)
- 타임아웃: 10초

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
