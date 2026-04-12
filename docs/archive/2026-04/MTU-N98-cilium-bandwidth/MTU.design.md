# MTU-N98: Cilium 대역폭 관리 -- Design

> **MTU ID**: MTU-N98
> **Plan 참조**: docs/01-plan/mtus/MTU-N98-cilium-bandwidth.plan.md
> **작성일**: 2026-04-10

---

## Design Anchor

| 항목 | 내용 |
|------|------|
| 목표 | EDT/BBR 기반 고성능 대역폭 관리 + N2SF 등급별 QoS |
| 제약 | k3s 단일 노드, Cilium 기존 설치 활용 |
| 검증 | 대역폭 제한 동작 확인, BBR 활성화 확인 |

## 아키텍처

```
[Pod] --netkit--> [Cilium eBPF] --EDT rate limit--> [네트워크]
                       |
                  [BBR 혼잡 제어]
                       |
                  [Hubble 메트릭] --> [Prometheus] --> [Grafana]
```

### 대역폭 정책

| 네임스페이스 | 등급 | Ingress 제한 | Egress 제한 |
|------------|------|-------------|------------|
| ai-gateway | O | 100Mbps | 50Mbps |
| monitoring | O | 500Mbps | 200Mbps |
| production | S | 1Gbps | 500Mbps |
| c-grade | C | 50Mbps | 25Mbps |
| default | O | 200Mbps | 100Mbps |

## 산출물

| # | 파일 | 설명 |
|---|------|------|
| 1 | infra/cilium/bandwidth-manager.yaml | 대역폭 관리 Helm values |
| 2 | infra/cilium/network-policies/bandwidth-limits.yaml | 대역폭 제한 정책 |
| 3 | infra/cilium/bbr-tuning.yaml | BBR 혼잡 제어 + sysctl |
| 4 | tests/e2e/test-cilium-bandwidth.sh | E2E 테스트 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 설계 | PM Agent |
