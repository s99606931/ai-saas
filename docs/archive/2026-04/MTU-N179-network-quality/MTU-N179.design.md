# MTU-N179: 네트워크 품질 모니터링 Design

> **문서 ID**: DESIGN-N179 | **버전**: 1.0 | **작성일**: 2026-04-10
> **작성자**: PM Lead | **상태**: 승인

---

## Executive Summary

| 관점 | 설계 결정 |
|------|----------|
| 아키텍처 | node_exporter + kube-state-metrics 기반 TCP/IP 계층 메트릭 수집, PrometheusRule로 알림 |
| 데이터 흐름 | node_exporter → Prometheus scrape → recording rules → Grafana + Alertmanager |
| 보안 | N2SF 영역별 네트워크 분리 메트릭, CSAP D-13 네트워크 보안 모니터링 |
| 운영 | 5단계 심각도 알림, 자동 에스컬레이션, 장애 분석 대시보드 |

## Design Anchor

```
Plan 참조: PLAN-N179
FR 범위: FR-N179.1 ~ FR-N179.6
CSAP 매핑: D-06 (감사 로깅), D-13 (네트워크 보안)
N2SF 매핑: N-03 (격리 영역)
```

## 아키텍처 옵션 분석

| 옵션 | 장점 | 단점 | 선택 |
|------|------|------|------|
| A: eBPF 기반 심층 패킷 분석 | 세밀한 분석 | 커널 의존성, 복잡도 높음 | - |
| B: node_exporter + recording rules | 경량, 검증된 방식 | L7 분석 제한 | **선택** |
| C: 전용 네트워크 모니터링 도구 | 전문 기능 | 외부 의존성, 비용 | - |

**선택 근거**: 옵션 B (Pragmatic Balance) - 기존 Prometheus 스택 활용, 추가 인프라 불필요, k3s 환경 최적

## 상세 설계

### DS-N179.1: TCP 재전송률 모니터링

```yaml
# recording rule: TCP 재전송률 계산
- record: node:network:tcp_retransmit_rate
  expr: |
    rate(node_netstat_Tcp_RetransSegs[5m])
    / rate(node_netstat_Tcp_OutSegs[5m]) * 100

# alert: TCP 재전송률 임계치 초과
- alert: HighTcpRetransmitRate
  expr: node:network:tcp_retransmit_rate > 1
  for: 5m
  labels:
    severity: warning
    csap: D-13
```

### DS-N179.2: 대역폭 사용률 모니터링

```yaml
# recording rule: 인터페이스별 대역폭 사용률
- record: node:network:bandwidth_utilization
  expr: |
    (rate(node_network_receive_bytes_total[5m])
    + rate(node_network_transmit_bytes_total[5m]))
    / node_network_speed_bytes * 100

# alert: 대역폭 80% 초과
- alert: HighBandwidthUtilization
  expr: node:network:bandwidth_utilization > 80
  for: 10m
  labels:
    severity: warning
```

### DS-N179.3: 패킷 손실률 모니터링

```yaml
# recording rule: 패킷 손실률
- record: node:network:packet_loss_rate
  expr: |
    (rate(node_network_receive_drop_total[5m])
    + rate(node_network_transmit_drop_total[5m]))
    / (rate(node_network_receive_packets_total[5m])
    + rate(node_network_transmit_packets_total[5m])) * 100
```

### DS-N179.4: Grafana 대시보드 레이아웃

```
Row 1: 종합 현황 (stat panels)
  - TCP 재전송률 | 패킷 손실률 | 대역폭 사용률 | RTT 평균
Row 2: 시계열 차트
  - TCP 재전송률 추이 | 대역폭 사용률 추이
Row 3: 상세 분석
  - 인터페이스별 트래픽 | 패킷 손실 상세 | 네트워크 오류
Row 4: N2SF 영역별 현황
  - C등급 영역 | S등급 영역 | O등급 영역 트래픽 분리
```

### DS-N179.5: N2SF 영역별 네트워크 모니터링

```yaml
# N2SF 등급별 네트워크 트래픽 분류
- record: n2sf:network:traffic_by_grade
  expr: |
    sum by (namespace, n2sf_grade) (
      rate(container_network_receive_bytes_total[5m])
    ) * on(namespace) group_left(n2sf_grade)
    kube_namespace_labels{label_n2sf_grade=~".+"}
```

### DS-N179.6: 네트워크 RTT 모니터링

```yaml
- record: node:network:tcp_rtt_avg
  expr: node_tcp_rtt_avg_seconds
  
- alert: HighNetworkLatency
  expr: node:network:tcp_rtt_avg > 0.1
  for: 5m
  labels:
    severity: warning
    csap: D-13
```

## Session Guide

```
1. node_exporter 메트릭 확인 → 2. recording rules 작성
3. alerting rules 작성 → 4. Grafana 대시보드 생성
5. 검증 스크립트 작성 → 6. Q-Gate 검증
```

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초안 작성 | PM Lead |
