# MTU-N195: Webhook 호출 성능 모니터링 -- Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/MTU-N195-webhook-performance.plan.md

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | Pragmatic Balance -- kube-apiserver 내장 메트릭 활용 |
| 메트릭 소스 | apiserver_admission_webhook_admission_duration_seconds, apiserver_admission_webhook_rejection_count |
| 알림 채널 | Alertmanager 표준 경로 |
| 대시보드 | Grafana JSON 프로비저닝 |

## 상세 설계

### 1. Recording Rules (FR-N195.1, FR-N195.3)

```yaml
webhook_perf:latency_p50 -- Webhook별 레이턴시 p50
webhook_perf:latency_p90 -- Webhook별 레이턴시 p90
webhook_perf:latency_p99 -- Webhook별 레이턴시 p99
webhook_perf:rejection_rate_5m -- 5분 거부율
webhook_perf:total_requests_rate_5m -- 5분 총 요청률
webhook_perf:error_rate_5m -- 5분 에러율
```

### 2. Alerting Rules (FR-N195.2, FR-N195.4, FR-N195.5)

| 알림명 | 조건 | 심각도 | for |
|--------|------|--------|-----|
| WebhookLatencyHigh | p99 > 500ms | warning | 5m |
| WebhookLatencyCritical | p99 > 1s | critical | 5m |
| WebhookRejectionRateHigh | 거부율 > 10% | warning | 5m |
| WebhookRejectionSpike | 거부율 > 30% | critical | 3m |
| WebhookErrorsDetected | 에러율 > 5% | critical | 5m |

### 3. 대시보드 패널 (FR-N195.6)

- Webhook별 레이턴시 히트맵
- 거부율 타임시리즈
- Webhook별 요청 수 통계
- 에러/타임아웃 목록

### 4. CSAP 매핑

| CSAP | 항목 | 구현 |
|------|------|------|
| D-08 | 접근 통제 | Webhook 거부율 감시 (보안 정책 시행 유효성) |
| D-10 | 서비스 가용성 | Webhook 레이턴시 SLO 준수 |
| D-12 | 개발 보안 | E2E 테스트 검증 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
