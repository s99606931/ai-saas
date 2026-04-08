# NetworkPolicy 네임스페이스 격리 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | INFRA-NETPOL-001 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-08 |
| MTU 매핑 | MTU-N28 |
| CSAP 매핑 | D-10-04 (네트워크 접근 통제) |
| N2SF 매핑 | N-01 (네트워크 격리) |

<!-- Design Ref: MTU-N28 Design -->
<!-- Plan SC: FR-N28.1~FR-N28.5 -->

---

## 1. 개요

Zero-trust 원칙에 따라 모든 네임스페이스에 default-deny 정책을 적용한 후,
필요한 트래픽만 명시적으로 허용합니다. k3s 기본 kube-router CNI의 NetworkPolicy API를 사용합니다.

---

## 2. 적용 현황

| 네임스페이스 | 정책 수 | default-deny | DNS 허용 | 내부 통신 | 특수 허용 |
|------------|--------|-------------|---------|---------|---------|
| saas-platform | 4 | O | O | O | Prometheus scraping |
| monitoring | 5 | O | O | O | Prometheus scraping + Grafana |
| gitops-demo | 3 | O | O | O | - |
| flux-system | 3 (기존) | - | - | - | egress + scraping + webhooks |
| **합계** | **15** | | | | |

---

## 3. 정책 계층 구조

```
Layer 1: default-deny-all        # 모든 트래픽 차단 (기본)
Layer 2: allow-dns               # CoreDNS 접근 필수 허용
Layer 3: allow-intra-namespace   # 동일 네임스페이스 내 통신 허용
Layer 4: allow-specific-cross-ns # 크로스 네임스페이스 명시 허용
```

---

## 4. 적용 명령

```bash
# 전체 적용
kubectl apply -f infra/network-policies/saas-platform/
kubectl apply -f infra/network-policies/monitoring/
kubectl apply -f infra/network-policies/gitops-demo/

# 확인
kubectl get networkpolicy -A

# 특정 네임스페이스 정책 확인
kubectl describe networkpolicy -n saas-platform
```

---

## 5. 검증 결과

| 검증 항목 | 결과 |
|---------|------|
| 적용 후 36 pods Running | PASS |
| Grafana 접근 (localhost:30302) | PASS |
| Prometheus 접근 (localhost:30090) | PASS |
| DNS 해석 정상 | PASS |
| 서비스 간 통신 정상 | PASS |

---

## 6. 정책 확장 가이드

### 신규 네임스페이스 추가 시

1. `infra/network-policies/{네임스페이스}/` 디렉토리 생성
2. `default-deny.yaml` 생성 (필수)
3. `allow-dns.yaml` 생성 (필수)
4. 필요한 허용 정책 추가
5. `kubectl apply` 후 Pod 상태 확인

### 크로스 네임스페이스 통신 추가 시

```yaml
# 예: new-app → saas-platform 통신 허용
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-from-new-app
  namespace: saas-platform
spec:
  podSelector: {}
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: new-app
```

---

## 7. CSAP 증적 체크리스트

| 항목 | CSAP 통제 | 증적 | 상태 |
|------|---------|------|------|
| default-deny 정책 | D-10-04 | YAML 파일 + kubectl 출력 | 완료 |
| 네임스페이스 격리 | D-10-04, N-01 | NetworkPolicy 15개 | 완료 |
| 모니터링 허용 | D-10-04 | Prometheus scraping 정상 | 완료 |
| Pod 안정성 | D-10-04 | 36 pods Running | 완료 |
