# MTU-N242: 예측적 장애 방지 -- Design

> **버전**: 1.0 | **작성일**: 2026-04-10

## 예측 알고리즘

`predict_linear(v range-vector, t scalar)`: 선형 회귀 기반 미래 값 예측.

### 예측 시나리오

| 시나리오 | 현재 메트릭 | 예측 윈도우 | 임계값 |
|---------|-----------|-----------|--------|
| 디스크 풀 | node_filesystem_free_bytes | 4h/24h/7d | < 10% |
| 메모리 OOM | container_memory_usage_bytes | 1h/4h | > 90% limit |
| 인증서 만료 | certmanager_certificate_expiration_timestamp | 30d/7d/1d | 남은 기간 |
| SLO 위반 | error_rate_5m | 1h/6h | > 에러 예산 |
| PV 포화 | kubelet_volume_stats_used_bytes | 24h | > 85% |
