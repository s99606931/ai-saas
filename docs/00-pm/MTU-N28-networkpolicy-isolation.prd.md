# PRD: MTU-N28 NetworkPolicy 네임스페이스 격리 강화

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N28 |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-08 |
| 작성자 | PM Lead (Opus 4.6) |
| 복잡도 | MED |

---

## WHY

CSAP D-10 (네트워크 보안)과 N2SF N-01 (네트워크 격리)은 네임스페이스 간 네트워크 격리를 요구합니다.
현재 flux-system에만 3개 NetworkPolicy가 있고, saas-platform/monitoring/gitops-demo에는 없습니다.
Zero-trust 원칙에 따라 default-deny 후 필요 트래픽만 허용하는 정책을 적용합니다.

## WHO

- k3s 클러스터 운영자
- CSAP 심사 대응팀 (D-10 증적)

## RISK

- 잘못된 NetworkPolicy로 서비스 간 통신 단절 가능
- CoreDNS 접근 차단 시 DNS 해석 불가

## SUCCESS

1. saas-platform 네임스페이스 default-deny 정책 적용
2. monitoring 네임스페이스 default-deny + Prometheus scraping 허용
3. 필수 인/아웃바운드 트래픽 허용 정책 (DNS, 서비스 간 통신)
4. 적용 후 모든 Pod Running 상태 유지 확인
5. 가이드 문서 작성

## SCOPE

### 포함
- 4개 네임스페이스 NetworkPolicy YAML 생성
- k3s 적용 및 검증
- 가이드 문서

### 제외
- Cilium 전환 (k3s 기본 kube-router 유지)
- Calico 설치

### 참조
- [Kubernetes NetworkPolicy 공식 문서](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [네임스페이스 격리 모범 사례](https://www.vcluster.com/blog/kubernetes-network-policies-for-isolating-namespaces)
