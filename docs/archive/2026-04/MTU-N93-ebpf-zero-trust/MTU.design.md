# MTU-N93: eBPF/Cilium 네트워크 관측성 + Zero Trust — Design

> **MTU ID**: MTU-N93
> **Plan 참조**: docs/01-plan/mtus/MTU-N93-ebpf-zero-trust.plan.md
> **작성일**: 2026-04-10

---

## Design Anchor

| 항목 | 내용 |
|------|------|
| 목표 | Cilium eBPF 기반 네트워크 관측 + Zero Trust mTLS |
| 제약 | k3s Flannel 대체 또는 공존, WSL2 eBPF 커널 지원 확인 |
| 기술 스택 | Cilium 1.15+, Hubble, eBPF, Helm |

## 1. Cilium 아키텍처

```
[Pod A] --eBPF--> [Cilium Agent] --mTLS--> [Cilium Agent] --eBPF--> [Pod B]
                       |
                       v
                  [Hubble Relay]
                       |
                       v
                  [Hubble UI] -- 네트워크 플로우 시각화
                       |
                       v
                  [Prometheus] -- 메트릭 수집
```

## 2. N2SF 등급별 네트워크 정책

| 등급 | 정책 | eBPF 레벨 |
|------|------|----------|
| C (기밀) | 인터넷 완전 차단, 내부 C등급만 통신 | L3/L4 + L7 |
| S (민감) | 외부 차단, 내부 S+O 통신 허용 | L3/L4 + L7 |
| O (공개) | AI GW 443만 외부 허용 | L3/L4 |

## 3. mTLS Zero Trust 구성

- Cilium WireGuard 기반 노드 간 암호화
- Pod 간 자동 mTLS (인증서 자동 교체)
- 서비스 아이덴티티 기반 정책 (SPIFFE)

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 설계 | PM Agent |
