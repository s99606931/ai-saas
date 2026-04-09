# MTU-N62: cert-manager TLS 인증서 자동화 설계

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: infra-architect

---

## 1. 아키텍처

```
cert-manager (cert-manager 네임스페이스)
  ├── SelfSigned ClusterIssuer → Root CA Certificate 발급
  ├── CA ClusterIssuer (root-ca-secret 참조) → 서비스 Certificate 서명
  └── Certificate CRs (각 네임스페이스)
       ├── auth-service-tls
       ├── api-gateway-tls
       ├── tenant-service-tls
       ├── audit-service-tls
       ├── ai-gateway-tls
       └── catalog-service-tls
```

## 2. Helm Values 설계

- replicas: 1 (WSL2 단일 노드)
- CRD 설치: crds.enabled=true
- Prometheus: prometheus.enabled=true, serviceMonitor.enabled=true
- 리소스: requests 10m/32Mi, limits 100m/128Mi

## 3. 인증서 체계

- Root CA: 자체 서명, 10년 유효, ECDSA P-256
- 서비스 인증서: Root CA 서명, 90일 유효, 만료 30일 전 자동 갱신
- 키 알고리즘: ECDSA P-256 (기본), RSA-4096 (호환성 필요 시)

## 4. 알림 규칙

- CertManagerCertExpiringSoon: 만료 30일 이내 warning
- CertManagerCertNotReady: Certificate Not Ready 상태 5분 이상 critical

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | infra-architect |
