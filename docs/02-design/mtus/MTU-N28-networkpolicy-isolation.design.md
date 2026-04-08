# Design: MTU-N28 NetworkPolicy 네임스페이스 격리 강화

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N28 |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-08 |
| 선택 옵션 | Option B: Pragmatic Balance |

---

## Design Anchor

- **결정**: k3s 기본 네트워크 정책 (kube-router CNI) 사용
- **근거**: 추가 CNI 설치 없이 기본 NetworkPolicy API로 충분
- **영향**: Cilium 고급 기능(L7 정책 등) 미사용, 향후 전환 가능

---

## 정책 구조

### 계층별 적용

```
1. default-deny-ingress     # 모든 인바운드 차단
2. default-deny-egress      # 모든 아웃바운드 차단
3. allow-dns                # CoreDNS 접근 허용 (필수)
4. allow-intra-namespace    # 동일 네임스페이스 내 통신 허용
5. allow-specific-cross-ns  # 특정 크로스 네임스페이스 허용
```

### 네임스페이스별 정책

| 네임스페이스 | 정책 | 허용 대상 |
|------------|------|---------|
| saas-platform | deny-all + allow-dns + allow-intra + allow-monitoring | 내부 + Prometheus |
| monitoring | deny-all + allow-dns + allow-scraping + allow-grafana | Prometheus + Grafana |
| gitops-demo | deny-all + allow-dns + allow-intra | 내부만 |
| flux-system | 기존 3개 정책 유지 | egress + scraping + webhooks |

---

## 디렉토리 구조

```
infra/network-policies/
  saas-platform/
    default-deny.yaml
    allow-dns.yaml
    allow-intra-namespace.yaml
    allow-monitoring-scrape.yaml
  monitoring/
    default-deny.yaml
    allow-dns.yaml
    allow-prometheus-scrape.yaml
    allow-grafana-ingress.yaml
  gitops-demo/
    default-deny.yaml
    allow-dns.yaml
    allow-intra-namespace.yaml
```
