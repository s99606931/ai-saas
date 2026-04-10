# MTU-N209: 네트워크 대역폭 사용량 모니터링 -- Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | Pragmatic Balance -- node-exporter + cAdvisor 조합 |
| 메트릭 소스 | node_network_receive/transmit_bytes_total, container_network_receive/transmit_bytes_total |

## 상세 설계

### Recording Rules
```yaml
net_bw:node_receive_bytes_rate      # 노드 수신 대역폭
net_bw:node_transmit_bytes_rate     # 노드 송신 대역폭
net_bw:node_receive_errors_rate     # 수신 에러율
net_bw:node_transmit_errors_rate    # 송신 에러율
net_bw:node_receive_drop_rate       # 수신 드롭율
net_bw:node_transmit_drop_rate      # 송신 드롭율
net_bw:pod_receive_bytes_rate       # Pod 수신 대역폭
net_bw:pod_transmit_bytes_rate      # Pod 송신 대역폭
net_bw:namespace_total_bandwidth    # 네임스페이스별 총 대역폭
```

### Alerting Rules
| 알림명 | 조건 | 심각도 |
|--------|------|--------|
| NetworkBandwidthHigh | 노드 대역폭 > 80% | warning |
| NetworkErrorsHigh | 에러율 > 1% | warning |
| NetworkDropsHigh | 드롭율 > 0.1% | critical |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
