# MTU-N66: External Secrets Operator 설계

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: security-architect

---

## 1. 아키텍처

```
External Secrets Operator (external-secrets 네임스페이스)
  ├── SecretStore: kubernetes-backend (saas 네임스페이스)
  │    └── provider: kubernetes (자체 클러스터)
  └── ExternalSecret (서비스별)
       ├── auth-service-secrets → DB URL, JWT Secret, OAuth
       ├── api-gateway-secrets → Rate Limit Config, API Keys
       ├── tenant-service-secrets → DB URL, Encryption Key
       ├── audit-service-secrets → DB URL, Storage Config
       ├── ai-gateway-secrets → LM Studio URL, API Key
       └── catalog-service-secrets → DB URL, Cache Config
```

## 2. Sealed Secrets + ESO 역할 분리

| 시점 | 도구 | 용도 |
|------|------|------|
| 배포 시점 | Sealed Secrets | Git에 암호화된 시크릿 저장, GitOps 배포 |
| 런타임 | ESO | 시크릿 동기화, 자동 회전, 드리프트 감지 |

## 3. 시크릿 회전 전략

- refreshInterval: 1h (1시간마다 소스와 동기화)
- creationPolicy: Owner (ESO가 Secret 소유)
- deletionPolicy: Retain (ESO 삭제 시 Secret 유지)

## 4. 모니터링

- externalsecret_status_condition: Sync 상태 추적
- 알림: ExternalSecretSyncFailed (5분 이상 실패 시 critical)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | security-architect |
