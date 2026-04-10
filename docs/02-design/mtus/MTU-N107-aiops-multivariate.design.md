# MTU-N107: AIOps 다변량 이상 탐지 고도화 — Design

> **MTU ID**: MTU-N107
> **작성일**: 2026-04-10

---

## 아키텍처: Pragmatic Balance

```
Prometheus -> 다변량 수집 -> Feature Engineering -> Model Inference -> Alert Dedup -> AlertManager
                                  |
                           학습 파이프라인 (CronJob)
                                  |
                          모델 저장소 (PVC)
```

### 알고리즘 선택 근거

| 알고리즘 | 용도 | 장점 |
|---------|------|------|
| Isolation Forest | 정적 다변량 탐지 | 비지도학습, 빠른 추론, 다차원 지원 |
| LSTM Autoencoder | 시계열 패턴 탐지 | 시간 의존성 포착, 계절성 학습 |
| 상관관계 분석 | 복합 이상 판별 | CPU+Memory+Network 동시 이상 = 단일 이벤트 |

### DS-N107.1: 다변량 특성 벡터

```yaml
features:
  - cpu_usage_percent
  - memory_usage_percent
  - network_rx_bytes_rate
  - network_tx_bytes_rate
  - disk_io_utilization
  - pod_restart_count_rate
  - http_error_rate_5xx
  - http_latency_p99
```

### DS-N107.3: 상관관계 규칙

1. CPU + Memory 동시 급증 -> 리소스 부족 (단일 알림)
2. Network + Latency 동시 이상 -> 네트워크 장애 (단일 알림)
3. Error Rate + Restart 동시 이상 -> 애플리케이션 장애 (단일 알림)

## Design Anchor

- Plan SC: FR-N107.1~FR-N107.6 전수 반영
- 기존 N83 Z-Score 설정과 병렬 운영 (단변량 + 다변량)
